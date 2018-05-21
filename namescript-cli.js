const toml = require('toml');
const fs = require('fs');
const MWBot = require('mwbot');
const LineByLineReader = require('line-by-line');
require('./namescript-lib.js');

const bot = new MWBot({
	apiUrl: 'https://www.wikidata.org/w/api.php'
});

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

	const randomHash = Math.floor(Math.random() * Math.pow(2, 48)).toString(16);
	namescript.config = {
		apiRequest: function(params, withEditToken) {
			if (withEditToken) {
				params.token = bot.editToken;
			}
			if (params.summary) {
				params.summary = 'namescript: ' + params.summary + ' ([[:toollabs:editgroups/b/CB/' + randomHash + '|details]])';
			}
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
		}
	};

	namescript.data = JSON.parse(fs.readFileSync('namescript-data.json', 'utf8'));

	const deletedIds = [];
	const failedIds = [];
	const errorInfos = [];
	for (const argument of process.argv.slice(2)) {
		if (argument.match(/^Q[1-9][0-9]*$/)) {
			processItem(argument, deletedIds, failedIds, errorInfos);
		} else if (fs.existsSync(argument)) {
			processFile(argument, deletedIds, failedIds, errorInfos);
		} else {
			throw "Unrecognized argument: " + argument;
		}
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

async function processFile(filename, deletedIds, failedIds, errorInfos) {
	const lr = new LineByLineReader(filename),
		  itemIds = [];
	lr.on('line', function(itemId) { itemIds.push(itemId); });
	await new Promise((accept, reject) => { lr.on('end', accept); lr.on('error', reject); });
	for (const itemId of itemIds) {
		processItem(itemId, deletedIds, failedIds, errorInfos);
	}
}

async function processItem(itemId, deletedIds, failedIds, errorInfos) {
	console.log(itemId);
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
	try {
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
