/*
  Adapted from [[User:Jon Harald Søby/namescript.js]] with help from Dereckson - Cannibalized from [[User:Jitrixis/nameGuzzler.js]] and [[MediaWiki:Gadget-autoEdit.js]]
  Updated by [[User:Tpt|Tpt]] and Harmonia Amanda
  Further butchered and rearranged by Lucas Werkmeister
*/

namescript = {
	config: { // filled in by namescript-browser.js or namescript-cli.js
		// function to send an API request with the specified parameters, adding an edit token if necessary
		apiRequest: async function(params, withEditToken) {
			throw new Error('not implemented');
		},
		// whether to clear descriptions or not before adding new ones
		clearDescriptions: false,
		// function to prepare adding the labels/etc., possibly waiting for user input before calling the async add() callback
		prepareAdd: async function(add) {
			throw new Error('not implemented');
		},
		// UI language code
		lang: 'en',
		// function to show an active informational message to the user
		infoActive: function(message) {},
		// function to show an active error message to the user
		errorActive: function(message) {},
		// function to attach an error message to the P31 statement
		errorP31: function(message) {},
		// function to show an active error message to the user, only in the CLI version
		errorCLI: function(message) {},
	},
	data: { // loaded from namescript-data.json by namescript-browser.js or namescript-cli.js
		// localized messages
		i18n: {},
		// description lists
		descriptions: {},
		// by default we use parenthesis ("$desc ($name)"), if not you should set something here
		descriptionWithName: {},
		// check for P1705
		langlist: {},
		// list of languages for aliases
		aliaslanglist: {},
		// list of supported scripts
		supportedScripts: [],
		/*
		 * List of not the same script languages.
		 *
		 * We maintain two different languages lists, as sometimes, we need an alias
		 * for a latin language: in Latvian, there is a mechanism to transliterate
		 * latin names into Latvian.
		 */
		nonScriptLangList: {}
	},
	start: async function(entity) {}, // actual implementation set at the end of this file
	translate: function(key) {} // actual implementation set at the end of this file
};

(function() {

	/* Return localized message */
	function translate(key) {
		if (namescript.data.i18n.hasOwnProperty(namescript.config.lang) &&
			namescript.data.i18n[namescript.config.lang].hasOwnProperty(key)) {
			return namescript.data.i18n[namescript.config.lang][key];
		} else {
			return namescript.data.i18n['en'][key];
		}
	}

	/**
	 * Return the comma-separator message for the given language.
	 * @param {string} lang MediaWiki language code.
	 * @return {string}
	 */
	function commaSeparator(lang) {
		// getting it from the API is super slow, so we just hard-code it :/
		if (/^(?:ar|fa)(?:-.*)?$/.test(lang)) {
			return '، ';
		}
		if (/^(?:gan|ja|lzh|yue|zh)(?:-.*)?$/.test(lang)) {
			return '、';
		}
		return ', ';
	}

	/**
	 * @param {object} entity An entity JSON object.
	 */
	async function inserteditlinks(entity) {
		const claims = entity['claims'];
		if (claims["P31"]) {
			const instanceOf = claims["P31"][0]["mainsnak"]["datavalue"]["value"]["id"];
			if ((["Q12308941", "Q11879590", "Q101352", "Q29042997", "Q3409032"].indexOf(instanceOf)) > -1) {
				if (claims["P1705"]) {
					const name = claims["P1705"][0]["mainsnak"]["datavalue"]["value"]["text"];

					if (claims["P282"]) {
						const script = claims["P282"][0]["mainsnak"]["datavalue"]["value"]["id"];

						const nameInKana = "P1814" in claims ?
							claims["P1814"][0]["mainsnak"]["datavalue"]["value"] :
							null;
						
						if(namescript.data.supportedScripts.indexOf(script) !== -1) {
							async function add() {
								if (namescript.config.clearDescriptions) {
									await clearDescriptions(entity);
								}
								if (instanceOf == "Q101352" || instanceOf == "Q29042997") {
									await prepareStuff(entity, name, nameInKana, "surname", script);
								} else if (instanceOf == "Q12308941") {
									await prepareStuff(entity, name, nameInKana, "male given name", script);
								} else if (instanceOf == "Q11879590") {
									await prepareStuff(entity, name, nameInKana, "female given name", script);
								} else if (instanceOf == "Q3409032") {
									await prepareStuff(entity, name, nameInKana, "unisex given name", script);
								} else {
									return false;
								}
							}
							await namescript.config.prepareAdd(add);
						} else {
							namescript.config.errorP31(translate('unknown-P282'));
						}
					} else {
						namescript.config.errorP31(translate('no-P282'));
					}
				} else {
					namescript.config.errorP31(translate('no-P1705'));
				}
			} else {
				// only report unknown or missing P31 in the CLI version
				namescript.config.errorCLI(translate('unknown-P31'));
				return false;
			}
		} else {
			namescript.config.errorCLI(translate('missing-P31'));
		}
	}

	/**
	 * Whether the given language is written using the given script.
	 * @param {string} lang MediaWiki language code.
	 * @param {string} script Wikidata item ID for the script.
	 * @return {bool}
	 */
	function isLatinLanguageCode(lang, script) {
		return namescript.data.nonScriptLangList[script].indexOf(lang) === -1;
	}

	/**
	 * Get the description for a name.
	 * @param {string} lang The language of the description.
	 * @param {string} name The native label statement value of the name item.
	 * @param {?string} nameInKana The name in kana statement value of the name item.
	 * @param {desctype} desctype One of "surname", "male given name", "female given name", "unisex given name"
	 * @param {string} script The writing system statement value of the name item.
	 * @return {string}
	 */
	function getDescription(lang, name, nameInKana, desctype, script) {
		const description = namescript.data.descriptions[desctype][script][lang];

		if (script === 'Q82772') { // kanji
			// neither the kanji (name) nor the kana (nameInKana) is unique on its own,
			// so use the combination of both for the description
			if (nameInKana === null) {
				namescript.config.errorP31(translate('no-P1814'));
				return description; // better than nothing, even though it will probably conflict
			}
			if (lang === 'ja') {
				name = nameInKana; // the native label is already in the label
			} else {
				name = name + commaSeparator(lang) + nameInKana;
			}
		} else if (isLatinLanguageCode(lang, script)) {
			return description;
		}

		var pattern = '$desc ($name)';
		if (lang in namescript.data.descriptionWithName) {
			pattern = namescript.data.descriptionWithName[lang];
		}
		return pattern.replace('$desc', description).replace('$name', name);
	}

	/**
	 * @param {object} entity An entity JSON object.
	 * @param {string} name The native label statement value of the name item.
	 * @param {?string} nameInKana The name in kana statement value of the name item.
	 * @param {desctype} desctype One of "surname", "male given name", "female given name", "unisex given name"
	 */
	async function prepareStuff(entity, name, nameInKana, desctype, script) {
		var jsonLabel = [];
		var jsonDesc = [];
		var jsonAliases = [];
		var existingdescs = entity["descriptions"];

		const languageinfo = (await namescript.config.apiRequest({
			action: 'query',
			meta: 'languageinfo',
			liprop: 'fallbacks',
		})).query.languageinfo;

		const { codesToSet, codesToRemove } = namescript.prepareLabels(name, languageinfo, namescript.data.langlist[script], entity);

		for (const codeToRemove of codesToRemove) {
			jsonLabel.push({language: codeToRemove, remove: ''});
		}
		for (const codeToSet of codesToSet) {
			jsonLabel.push({language: codeToSet, value: name});
		}
		if (jsonLabel.length === 0) {
			namescript.config.infoActive(translate('all-set'));
		}

		for (var j = 0; j < namescript.data.aliaslanglist[script].length; j++) {
			jsonAliases.push( [{
				language: namescript.data.aliaslanglist[script][j],
				value: name,
				add: ""
			}] );
			if (nameInKana && script === 'Q82772') {
				jsonAliases.push( [{
					language: namescript.data.aliaslanglist[script][j],
					value: nameInKana,
					add: ""
				}] );
			}
		}

		for (const lang in namescript.data.descriptions[desctype][script]) {
			if (!existingdescs[lang]) {
				jsonDesc.push({
					language: lang,
					value: getDescription(lang, name, nameInKana, desctype, script)
				});
			}
		}

		let summary = '';
		if (codesToSet.size > 0) {
			summary += 'adding ' + codesToSet.size + ' labels';
		}
		if (codesToRemove.size > 0) {
			if (summary.length > 0) {
				summary += ', ';
			}
			summary += 'removing ' + codesToRemove.size + ' labels';
		}
		if (jsonDesc.length > 0) {
			if (summary.length > 0) {
				summary += ', ';
			}
			summary += 'adding ' + jsonDesc.length + ' descriptions';
		}
		if (jsonAliases.length > 0) {
			if (summary.length > 0) {
				summary += ', ';
			}
			summary += 'updating aliases';
		}
		summary += ' for ' + desctype;
		summary = summary.replace(/, (?=[^,]*$)/, ' and '); // replace last ', ' with ' and '

		await setItem(JSON.stringify({
			'descriptions': jsonDesc,
			'labels': jsonLabel,
			'aliases': jsonAliases
		}), entity.id, summary);
	}

	// this function is added to the namescript global for testing purposes
	namescript.prepareLabels = function(name, languageinfo, langlist, entity) {
		const workList = [...langlist];
		const codesToSet = new Set(['mul']);
		const codesToRemove = new Set();
		const codesToKeep = new Set();

		// maximum length of fallback chains (plus one to account for implicit 'en' fallback)
		const maxFallbacks = Math.max(...Object.values(languageinfo).map(({fallbacks}) => fallbacks.length + 1));

		for (let i = 0; i < maxFallbacks * 2 && workList.length > 0; i++) {
			work:
			for (let j = 0; j < workList.length; j++) {
				const languageCode = workList[j];
				const languageLabel = entity.labels[languageCode]?.value;
				if (languageLabel && languageLabel !== name) {
					// keep this label which is not the same as the name
					codesToKeep.add(languageCode);
					// remove from workList
					workList.splice(j, 1);
					// counteract j++ at the end of the loop because we removed an element
					j--;
					continue;
				}
				let knownToFallBackToMul = true;
				fallbacks:
				for (const fallbackCode of [...languageinfo[languageCode].fallbacks, 'en']) {
					if (fallbackCode === languageCode) {
						// not an actual fallback (probably caused by the insertion of 'en' above)
						continue fallbacks;
					}
					const fallbackLabel = entity.labels[fallbackCode]?.value;
					if (fallbackLabel && fallbackLabel !== name) {
						// set this label to the name so it does not fall back to a different label
						codesToSet.add(languageCode);
						// remove from workList
						workList.splice(j, 1);
						// counteract j++ at the end of the loop because we removed an element
						j--;
						continue work;
					}
					if (!fallbackLabel && !langlist.includes(fallbackCode)) {
						// no need to consider this fallback code at all, continue
						continue fallbacks;
					}
					if (codesToKeep.has(fallbackCode) || codesToSet.has(fallbackCode)) {
						// this label is not going to fall back to mul, so set it to make sure no fallback indicator is shown
						codesToSet.add(languageCode);
						// remove from workList
						workList.splice(j, 1);
						// counteract j++ at the end of the loop because we removed an element
						j--;
						continue work;
					}
					if (codesToRemove.has(fallbackCode)) {
						// this fallback language will be irrelevant, continue
						continue fallbacks;
					}
					if (fallbackLabel === name) {
						// we’ll have to see if this fallback will be kept or not, possibly in the next iteration of the outermost loop
						knownToFallBackToMul = false;
					}
				}
				if (knownToFallBackToMul) {
					// this label will fall back all the way to mul, remove it
					codesToRemove.add(languageCode);
					// remove from workList
					workList.splice(j, 1);
					// counteract j++ at the end of the loop because we removed an element
					j--;
				}
			}
		}

		for (const languageCode of workList) {
			// anything left in the work list must be a cycle between fallback languages that are all set to the name
			for (const fallbackCode of [languageCode, ...languageinfo[languageCode].fallbacks, 'en']) {
				const fallbackLabel = entity.labels[fallbackCode]?.value;
				if (!fallbackLabel && !langlist.includes(fallbackCode)) {
					// no need to consider this fallback code at all
					continue;
				}
				if (!codesToRemove.has(fallbackCode) && !workList.includes(fallbackCode)) {
					throw new Error(
						'Namescript error: fallback language ' + fallbackCode + ' of language ' + languageCode +
							' is not going to be removed but has no clear reason to be kept either'
					);
				}
				if (fallbackLabel && fallbackLabel !== name) {
					throw new Error(
						'Namescript error: fallback language ' + fallbackCode + ' of language ' + languageCode +
							' is not going to be removed but has a different label'
					);
				}
			}
			codesToRemove.add(languageCode);
		}

		for (const codeToRemove of codesToRemove) {
			if (!(codeToRemove in entity.labels)) {
				codesToRemove.delete(codeToRemove);
			}
		}

		return { codesToSet, codesToRemove, codesToKeep };
	}

	/**
	 * Edit an entity.
	 * @param {object} item The entity data.
	 * @param {string} itemId The entity ID.
	 * @param {string} summary The summary for the edit.
	 */
	async function setItem(item, itemId, summary) {
		const data = await namescript.config.apiRequest({
			action: 'wbeditentity',
			id: itemId,
			data: item,
			summary: summary,
			exclude: 'pageid|ns|title|lastrevid|touched|sitelinks|aliases'
		}, true);
		if (data.success === 1) {
			namescript.config.infoActive('Sent: ' + summary);
		} else {
			namescript.config.errorActive(data);
		}
	}

	/**
	 * Remove all the descriptions of an entity.
	 * @param {object} entity The entity data.
	 */
	async function clearDescriptions(entity) {
		const payload = { descriptions: [] };
		for (const language in entity.descriptions) {
			payload.descriptions.push({ language: language, remove: '' });
		}
		entity.descriptions = {};
		return await namescript.config.apiRequest({
			action: 'wbeditentity',
			id: entity.id,
			data: JSON.stringify(payload),
			summary: 'deleting all existing descriptions before adding new ones'
		}, true);
	}

	namescript.start = inserteditlinks;
	namescript.translate = translate;
})();