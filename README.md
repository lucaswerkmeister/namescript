# namescript

Command-line version of [User:Harmonia Amanda/namescript.js](https://www.wikidata.org/wiki/User:Harmonia_Amanda/namescript.js),
supports fixing up several items at once
and deletes all existing descriptions before adding new ones.
Use with caution!

## Setup

(The following commands should be run in the [command-line interface](https://en.wikipedia.org/wiki/Command-line_interface) of a Linux system.)

Clone the repository.

```sh
git clone https://github.com/lucaswerkmeister/namescript.git
cd namescript
```

Install dependencies.

```sh
npm install
```

Copy the configuration file…

```sh
cp config.toml.example config.toml
```

…and edit it with your favorite editor to insert your Wikimedia username and password.
(You can also do this step with a graphical editor, if you like.)
Optionally, you can choose a different language than English as well.

```sh
nano config.toml
```

This setup only needs to be run once;
afterwards, to update to a newer version of the software,
run the following command (inside the `namescript` directory):

```sh
git pull
```

## Usage

Once the script is set up, you can run it on any number of items.
For example, the following command will adjust the two Wikidata sandbox items:

```sh
node namescript.js Q4115189 Q13406268
```

Note that the script will silently skip any items that are not name items (and looks only at the *first* “instance of” statement),
so depending on the current state of the sandbox items the above command may not do anything.
(However, you can still use it to test if the configuration file is correct,
since the script will attempt to login before looking at the items.)

## Possible problems

### “command not found”

If you get “command not found” errors, make sure all of the following packages are installed:

* git
* npm
* node
* nano

The process for this varies by Linux distribution; on Debian or Ubuntu, try this:

```sh
sudo apt install git npm nodejs nano
```

Also, the `node` command may be called `nodejs` or `node.js` on some distributions –
if you still get errors after installing all packages,
try running `nodejs namescript.js` or `node.js namescript.js`.

### SyntaxError: unexpected token `{`

If `node namescript.js` reports a syntax error, your Node.js version might be too outdated.
If your distribution does not offer a more recent version,
the easiest way to get a newer version of Node.js is to use Node Version Manager.
Try the following commands:

```
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash
nvm install node
nvm use node
```

This should install the newest version of Node.js and register it as the default version.
If you get a “command not found” error for `nvm` at the second step,
try closing the current terminal and opening a new one,
and then run the two `nvm` commands.

If those instructions don’t work,
please refer to the [nvm README file](https://github.com/creationix/nvm#readme) for details.

## License

CC-BY-SA (as it comes from a wiki page),
but the authorship is complicated.
See the [full history](https://www.wikidata.org/w/index.php?title=User:Harmonia_Amanda/namescript.js&action=history) of the original user script,
as well as of the pages mentioned in the comments at the top of the script.
