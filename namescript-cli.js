const toml = require('toml');
const fs = require('fs');
const MWBot = require('mwbot');
const LineByLineReader = require('line-by-line');
require('./namescript-lib.js');

const bot = new MWBot({
	apiUrl: 'https://www.wikidata.org/w/api.php'
});
let lastItemId = null;
const deletedIds = [];
const failedIds = [];
const errorInfos = [];

async function main() {
	let configStr;
	try {
		configStr = fs.readFileSync('config.toml', 'utf8');
	} catch (e) {
		console.error('config.toml file could not be read');
		console.error('Please copy config.toml.example to config.toml and enter your own username and password');
		process.exit(1);
		return;
	}
	const config = toml.parse(configStr);
	if ('ui' in config && 'language' in config['ui']) {
		namescript.config.lang = config['ui']['language'];
	}

	await bot.loginGetEditToken({
		username: config['auth']['username'],
		password: config['auth']['password']
	});

	let randomHash = Math.floor(Math.random() * Math.pow(2, 48)).toString(16);
	namescript.config = {
		apiRequest: function(params, withEditToken) {
			if (withEditToken) {
				params.token = bot.editToken;
			}
			if (params.summary && randomHash) {
				params.summary = 'namescript: ' + params.summary + ' ([[:toollabs:editgroups/b/CB/' + randomHash + '|details]])';
			}
			params.assert = 'user';
			return bot.request(params);
		},
		clearDescriptions: true,
		prepareAdd: async function(add) {
			return await add();
		},
		infoActive: function(message) {
			console.log(message);
		},
		errorActive: function(message) {
			console.error(message);
		},
		errorP31: function(message) {
			console.error(message);
		},
		errorCLI: function(message) {
			console.error(message);
		},
	};

	namescript.data = JSON.parse(fs.readFileSync('namescript-data.json', 'utf8'));

	try {
		for (const argument of process.argv.slice(2)) {
			if (isItemId(argument)) {
				await processItem(argument);
			} else if (fs.existsSync(argument)) {
				await processFile(argument);
			} else if (argument === 'sandbox') {
				const randomHash_ = randomHash;
				randomHash = null;
				await processSandbox('Q4115189');
				randomHash = randomHash_;
			} else {
				throw "Unrecognized argument: " + argument;
			}
		}
	} catch (e) {
		console.error('BUG: unhandled error during processing, aborting');
		console.error(e);
		console.error('The last item ID we started working on was: ' + lastItemId);
		failedIds.push(lastItemId);
	}
	if (deletedIds.length) {
		console.log('There was no data for the following item IDs: ' + deletedIds.join(', '));
	}
	if (failedIds.length) {
		console.log('There was an error for the following item IDs: ' + failedIds.join(', '));
		if (errorInfos.length) {
			console.log('Specifically, the API returned the following error messages:');
			for (const errorInfo of errorInfos) {
				console.log(errorInfo);
			}
		}
	}
}

function isItemId(string) {
	return string.match(/^Q[1-9][0-9]*$/);
}

async function processFile(filename) {
	const lr = new LineByLineReader(filename),
		  itemIds = [];
	lr.on('line', function(itemId) { itemIds.push(itemId); });
	await new Promise((accept, reject) => { lr.on('end', accept); lr.on('error', reject); });
	for (const itemId of itemIds) {
		await processItem(itemId);
	}
}

async function processSandbox(sandboxItemId) {
	console.log(`Item page: https://www.wikidata.org/wiki/${sandboxItemId}`);
	console.log(`History:   https://www.wikidata.org/wiki/${sandboxItemId}?action=history`);
	const claims = {
		P31: '{"entity-type": "item", "id": "Q12308941"}', // instance of: male given name
		P1705: '{"language": "en", "text": "sandbox given name"}', // native label: sandbox given name (English)
		P282: '{"entity-type": "item", "id": "Q8229"}' // writing system: Latin script
	};
	for (const [propertyId, value] of Object.entries(claims)) {
		await bot.request({
			action: 'wbcreateclaim',
			entity: sandboxItemId,
			snaktype: 'value',
			property: propertyId,
			value: value,
			token: bot.editToken
		});
	}
	await processItem(sandboxItemId);
}

async function processItem(itemId) {
	if (!isItemId(itemId)) {
		console.error('Not a valid item ID: ' + itemId);
		return;
	}
	console.log(itemId);
	lastItemId = itemId;
	try {
		const response = await bot.request({
			action: 'wbgetentities',
			ids: itemId,
			props: 'labels|descriptions|claims'
		});
		const entity = response &&
			  response['entities'] &&
			  response['entities'][itemId];
		if (!entity || !entity['claims']) {
			console.error('No data for ' + itemId + '!');
			deletedIds.push(itemId);
			return;
		}
		await namescript.start(response['entities'][itemId]);
	} catch (e) {
		console.error('Error while editing ' + itemId + '!');
		console.error(e);
		failedIds.push(itemId);
		if (e.info) {
			errorInfos.push(e.info);
		}
	}
}

main().catch(function(error) {
	console.error(error);
	process.exit(1);
});
