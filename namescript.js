/*
  Adapted from [[User:Jon Harald Søby/namescript.js]] with help from Dereckson - Cannibalized from [[User:Jitrixis/nameGuzzler.js]] and [[MediaWiki:Gadget-autoEdit.js]]
  Updated by [[User:Tpt|Tpt]] and Harmonia Amanda
*/

const https = require('https');
const request = require('request');
const toml = require('toml');
const concat = require('concat-stream');
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
	for (const itemId of process.argv.slice(2)) {
		console.log(itemId);
		const response = await bot.request({
			action: 'wbgetentities',
			ids: itemId,
			props: 'labels|descriptions|claims'
		}).catch(die);
		await inserteditlinks(response['entities'][itemId]);
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
						await clearDescriptions(entity);
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
					} else {
						console.error(translate('unknown-P282'));
					}
				} else {
					console.error(translate('no-P282'));
				}
			} else {
				console.error(translate('no-P1705'));
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
		console.log(translate('all-set'));
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
	const data = await bot.request({
		action: 'wbeditentity',
		id: itemId,
		data: item,
		summary: summary,
		exclude: 'pageid|ns|title|lastrevid|touched|sitelinks|aliases',
		token: bot.editToken
	}).catch(console.error);
	if (data.success === 1) {
		console.log('Sent: ' + summary);
	} else {
		console.error(data);
	}
}

async function clearDescriptions(entity) {
	const payload = { descriptions: [] };
	for (const language in entity.descriptions) {
		payload.descriptions.push({ language: language, remove: '' });
	}
	entity.descriptions = {};
	return await bot.request({
		action: 'wbeditentity',
		id: entity.id,
		data: JSON.stringify(payload),
		summary: 'Delete all descriptions (part of namescript)',
		token: bot.editToken
	}).catch(console.error);
}

main();
