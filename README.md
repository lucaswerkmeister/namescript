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

## License

CC-BY-SA (as it comes from a wiki page),
but the authorship is complicated.
See the [full history](https://www.wikidata.org/w/index.php?title=User:Harmonia_Amanda/namescript.js&action=history) of the original user script,
as well as of the pages mentioned in the comments at the top of the script.
