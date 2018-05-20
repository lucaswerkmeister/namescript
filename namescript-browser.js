const sourceUser = 'NAMESCRIPT_SOURCE_USER'; // **IF YOU COPY THIS USER SCRIPT TO YOUR OWN PAGE, REPLACE THIS WITH YOUR OWN USER NAME**

$.when(
	$.get('https://www.wikidata.org/w/index.php?title=User:' + sourceUser + '/namescript-lib.js&action=raw&ctype=text/javascript'),
	$.get('https://www.wikidata.org/w/index.php?title=User:' + sourceUser + '/namescript-data.json&action=raw&ctype=application/json'),
	$.Deferred(function(deferred) {
		mw.hook('wikibase.entityPage.entityLoaded').add(deferred.resolve);
	})
).then(function(namescriptLibXhr, namescriptDataXhr, entity) {
	const api = new mw.Api();
	namescript.config = {
		apiRequest: /* async */ function(params, withEditToken) {
			// mw.Api uses jQuery.Promise, so we have to map to native Promise manually
			return new Promise(function(resolve, reject) {
				let $promise;
				if (withEditToken) {
					$promise = api.postWithEditToken(params);
				} else {
					$promise = api.get(params);
				}
				$promise.then(resolve, function(code, result, result2, jqXh) { reject(result); });
			});
		},
		clearDescriptions: false,
		prepareAdd: async function(add) {
			$('#P31 .wikibase-snakview-variation-valuesnak a').after($('<div  />', {
				css: {
					"font-weight": "bold",
					"cursor": "pointer"
				},
				text: namescript.translate('add-button'),
				click: function() {
					return add().catch(function(result) {
						namescript.config.errorActive(result.error.info);
					});
				}
			}));
		},
		lang: mw.config.get('wgUserLanguage'),
		infoActive: function(message) {
			mw.notify(message, {
				title: namescript.translate('title'),
				tag: 'Name script'
			});
		},
		errorActive: function(message) {
			mw.notify(message, {
				title: namescript.translate('title'),
				tag: 'Name script',
				type: 'error'
			});
		},
		errorP31: function(message) {
			$('#P31 .wikibase-snakview-variation-valuesnak a').after($('<div />', {
				text: message,
				css: {
					"color": "#f00"
				}
			}));
		}
	};
	namescript.data = namescriptDataXhr[0];
	namescript.start(entity).catch(function(e) {
		namescript.config.errorActive(e);
	});
});
