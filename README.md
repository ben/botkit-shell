# Botkit-Shell

This is a shell adapter for testing a [botkit](https://github.com/howdyai/botkit) bot, derived from the [Slack adapter](https://github.com/howdyai/botkit/blob/master/lib/SlackBot.js).

## Installing

You'll want to be running Node 6.1.0 or newer.

```shell
$ npm install --save botkit-shell
```

## Initializating

In your bot initialization code, do this:

```js
let shellbot = require('botkit-shell')
controller = shellbot({})
controller.spawn({})
```

The shellbot follows most of the same conventions as the Slack bot, since it's written

## Using

Start up your bot with this adapter, and you should get a prompt that looks like this:

```shell
##>
```

Interact as though you were in a public channel.
Switch to a DM context with `\dm`, switch back with `\ch`.
Do `\?` for more info on the shell commands.
