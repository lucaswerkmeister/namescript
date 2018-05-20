const fs = require('fs');
const MWBot = require('mwbot');

async function main() {
	const bot = new MWBot({
		apiUrl: 'https://www.wikidata.org/w/api.php'
	});
	const sourceUser = 'Harmonia_Amanda';

	for (const file of ['namescript-lib.js', 'namescript-data.json', 'namescript-browser.js', 'namescript.js']) {
		const response = await bot.read('User:' + sourceUser + '/' + file),
			  page = response.query.pages[Object.keys(response.query.pages)[0]];
		var content = page.revisions[0]['*'];
		content = content.replace(sourceUser, 'NAMESCRIPT_SOURCE_USER');
		fs.writeFileSync(file, content, 'utf8');
	}
}

main().catch(console.error);
