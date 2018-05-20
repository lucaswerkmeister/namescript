const toml = require('toml');
const fs = require('fs');
const MWBot = require('mwbot');

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
	const config = toml.parse(configStr),
		  username = config['auth']['username'],
		  password = config['auth']['password'];
	const bot = new MWBot({
		apiUrl: 'https://www.wikidata.org/w/api.php'
	});
	await bot.loginGetEditToken({
		username: username,
		password: password
	});

	for (const file of ['namescript.js', 'namescript-lib.js', 'namescript-data.json', 'namescript-browser.js']) {
		await bot.edit('User:' + username + '/' + file, fs.readFileSync(file, 'utf8'), 'Import from https://github.com/lucaswerkmeister/namescript');
	}
}

main().catch(console.error);
