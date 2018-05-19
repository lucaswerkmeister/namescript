/*
  Adapted from [[User:Jon Harald Søby/namescript.js]] with help from Dereckson - Cannibalized from [[User:Jitrixis/nameGuzzler.js]] and [[MediaWiki:Gadget-autoEdit.js]]
  Updated by [[User:Tpt|Tpt]] and Harmonia Amanda
*/

const toml = require('toml');
const fs = require('fs');
const MWBot = require('mwbot');

const bot = new MWBot({
	apiUrl: 'https://www.wikidata.org/w/api.php'
});
var lang = 'en';

const {
	// localized messages
	i18n,
	// description lists
	descriptions,
	// by default we use parenthesis ("$desc ($name)"), if not you should set something here
	descriptionWithName,
	// check for P1705
	langlist,
	// list of languages for aliases
	aliaslanglist,
	// list of supported scripts
	supportedScripts,
	/*
	 * List of not the same script languages.
	 *
	 * We maintain two different languages lists, as sometimes, we need an alias
	 * for a latin language: in Latvian, there is a mechanism to transliterate
	 * latin names into Latvian.
	 */
	nonScriptLangList
} = JSON.parse(fs.readFileSync('namescript-data.json', 'utf8'));

let namescriptConfig = {
	// function to send an API request with the specified parameters
	apiRequest: function(params) {
		throw new Error('not implemented');
	},
	// whether to clear descriptions or not before adding new ones
	clearDescriptions: false,
	// function to prepare adding the labels/etc., possibly waiting for user input before calling the add() callback
	prepareAdd: function(add) {
		throw new Error('not implemented');
	},
	// function to show an active informational message to the user
	infoActive: function(message) {},
	// function to show an active error message to the user
	errorActive: function(message) {},
	// function to attach an error message to the P31 statement
	errorP31: function(message) {}
};

async function main() {
	let configStr;
	try {
		configStr = fs.readFileSync('config.toml', 'utf8');
	} catch (e) {
		die('config.toml file could not be read\n' +
			'Please copy config.toml.example to config.toml and enter your own username and password');
	}
	const config = toml.parse(configStr);
	if ('ui' in config && 'language' in config['ui']) {
		const confLang = config['ui']['language'];
		if (i18n.hasOwnProperty(confLang)) {
			lang = confLang;
		}
	}
	await bot.loginGetEditToken({
		username: config['auth']['username'],
		password: config['auth']['password']
	}).catch(die);

	namescriptConfig = {
		apiRequest: function(params) {
			params.token = bot.editToken;
			return bot.request(params);
		},
		clearDescriptions: true,
		prepareAdd: function(add) {
			add();
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

	const deletedIds = [];
	const failedIds = [];
	const errorInfos = [];
	for (const itemId of process.argv.slice(2)) {
		console.log(itemId);
		const response = await bot.request({
			action: 'wbgetentities',
			ids: itemId,
			props: 'labels|descriptions|claims'
		}).catch(die);
		const entity = response &&
			  response['entities'] &&
			  response['entities'][itemId];
		if (!entity || !entity['claims']) {
			console.error('No data for ' + itemId + '!');
			deletedIds.push(itemId);
			continue;
		}
		try {
			await inserteditlinks(response['entities'][itemId]);
		} catch (e) {
			console.error('Error while editing ' + itemId + '!');
			console.error(e);
			failedIds.push(itemId);
			if (e.info) {
				errorInfos.push(e.info);
			}
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

function die(error) {
	console.error(error);
	process.exit(1);
}

/* Return localized message */
function translate(key) {
	if (i18n[lang].hasOwnProperty(key)) {
		return i18n[lang][key];
	} else {
		return i18n['en'][key];
	}
}

async function inserteditlinks(entity) {
	const claims = entity['claims'];
	if (claims["P31"]) {
		const instanceOf = claims["P31"][0]["mainsnak"]["datavalue"]["value"]["id"];
		if ((["Q12308941", "Q11879590", "Q101352", "Q29042997", "Q3409032"].indexOf(instanceOf)) > -1) {
			if (claims["P1705"]) {
				const name = claims["P1705"][0]["mainsnak"]["datavalue"]["value"]["text"];

				if (claims["P282"]) {
					const script = claims["P282"][0]["mainsnak"]["datavalue"]["value"]["id"];
					
					if(supportedScripts.indexOf(script) !== -1) {
						async function add() {
							if (namescriptConfig.clearDescriptions) {
								await clearDescriptions(entity);
							}
							if (instanceOf == "Q101352" || instanceOf == "Q29042997") {
								await prepareStuff(entity, name, "surname", script);
							} else if (instanceOf == "Q12308941") {
								await prepareStuff(entity, name, "male given name", script);
							} else if (instanceOf == "Q11879590") {
								await prepareStuff(entity, name, "female given name", script);
							} else if (instanceOf == "Q3409032") {
								await prepareStuff(entity, name, "unisex given name", script);
							} else {
								return false;
							}
						}
						namescriptConfig.prepareAdd(add);
					} else {
						namescriptConfig.errorP31(translate('unknown-P282'));
					}
				} else {
					namescriptConfig.errorP31(translate('no-P282'));
				}
			} else {
				namescriptConfig.errorP31(translate('no-P1705'));
			}
		} else {
			return false;
		}
	}
}

function isLatinLanguageCode(lang, script) {
	return nonScriptLangList[script].indexOf(lang) === -1;
}

function getDescription(lang, name, desctype, script) {
	const description = descriptions[desctype][script][lang];

	if (isLatinLanguageCode(lang, script)) {
		return description;
	}

	var pattern = '$desc ($name)';
	if (lang in descriptionWithName) {
		pattern = descriptionWithName[lang];
	}
	return pattern.replace('$desc', description).replace('$name', name);
}

async function prepareStuff(entity, name, desctype, script) {
	var countlabels = 0;
	var countdescs = 0;
	var countaliases = 0;
	var jsonLabel = [];
	var jsonDesc = [];
	var jsonAliases = [];
	var existingdescs = entity["descriptions"];
	var newdesclist = {};
	
	var existinglabels = entity["labels"];
	var newlanglist = [];
	for (var i = 0; i < langlist[script].length; i++) {
		if (!existinglabels[langlist[script][i]]) {
			newlanglist.push(langlist[script][i]);
		}
	}
	
	if (newlanglist.length === 0) {
		namescriptConfig.infoActive(translate('all-set'));
	} else {
		for (var j = 0; j < newlanglist.length; j++) {
			countlabels++;
			jsonLabel.push({
				language: newlanglist[j],
				value: name
			});
		}
	}
	for (var j = 0; j < aliaslanglist[script].length; j++) {
		countaliases++;
		jsonAliases.push( [{
			language: aliaslanglist[script][j],
			value: name,
			add: ""
		}] );
	}

	for (const lang in descriptions[desctype][script]) {
		if (!existingdescs[lang]) {
			countdescs++;
			jsonDesc.push({
				language: lang,
				value: getDescription(lang, name, desctype, script)
			});
		}
	}

	await setItem(JSON.stringify({
		'descriptions': jsonDesc,
		'labels': jsonLabel,
		'aliases': jsonAliases
	}), entity.id, "Adding " + countlabels + " labels, " + countdescs + " descriptions and updating aliases for " + desctype);
}

async function setItem(item, itemId, summary) {
	const data = await namescriptConfig.apiRequest({
		action: 'wbeditentity',
		id: itemId,
		data: item,
		summary: summary,
		exclude: 'pageid|ns|title|lastrevid|touched|sitelinks|aliases'
	});
	if (data.success === 1) {
		namescriptConfig.infoActive('Sent: ' + summary);
	} else {
		namescriptConfig.errorActive(data);
	}
}

async function clearDescriptions(entity) {
	const payload = { descriptions: [] };
	for (const language in entity.descriptions) {
		payload.descriptions.push({ language: language, remove: '' });
	}
	entity.descriptions = {};
	return await namescriptConfig.apiRequest({
		action: 'wbeditentity',
		id: entity.id,
		data: JSON.stringify(payload),
		summary: 'Delete all descriptions (part of namescript)'
	});
}

main();
