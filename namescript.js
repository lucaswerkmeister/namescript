if (typeof window === 'object' &&
	typeof document === 'object' &&
	typeof mw === 'object' &&
	typeof $ === 'function') {
	const sourceUser = 'NAMESCRIPT_SOURCE_USER'; // **IF YOU COPY THIS USER SCRIPT TO YOUR OWN PAGE, REPLACE THIS WITH YOUR OWN USER NAME**
	$.get('https://www.wikidata.org/w/index.php?title=User:' + sourceUser + '/namescript-browser.js&action=raw&ctype=text/javascript');
} else if (typeof require === 'function') {
	require('./namescript-cli.js');
} else {
	console.error('Could not detect environment!');
}
