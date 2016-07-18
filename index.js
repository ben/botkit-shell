'use strict';
let core = require('botkit').core
let Path = require('path')
let request = require('request')
let express = require('express')
let chalk = require('chalk')
let cline = require('cline')
let ansi = require('ansi')
var bodyParser = require('body-parser');

function worker (botkit, config) {
  let bot = {
    botkit: botkit,
    config: config || {},
    utterances: botkit.utterances,
    identity: { // default identity values
      id: 'shellbot',
      name: 'ShellBot'
    }
  }

  botkit.startTicking()

  let cl = cline()
  cl.on('close', () => { process.exit() })

  let cursor = ansi(process.stdout)

  let channel = '##'
  function setChannel (newChannel) {
    channel = newChannel
    cl.interact(chalk.gray(`${channel}> `))
  }

  cl.command('/dm', 'switch to DM context', () => { setChannel('DM') })
  cl.command('/ch', 'switch to channel context', () => { setChannel('##') })
  cl.command('*', (input) => {
    botkit.debug(`GOT '${input}'`)
    botkit.receiveMessage(bot, {
      type: 'message',
      channel: channel,
      user: 'SHELLUSER',
      text: input,
      ts: new Date().getTime()
    })
    return false
  })
  setTimeout(() => { setChannel('##') }, 10)

  /**
  * Convenience method for creating a DM convo.
  */
  bot.startPrivateConversation = function (message, cb) {
    botkit.startTask(this, message, function (task, convo) {
      bot._startDM(task, message.user, function (err, dm) {
        convo.stop()
        cb(err, dm)
      })
    })
  }

  bot.startConversation = function (message, cb) {
    botkit.startConversation(this, message, cb)
  }

  /**
  * Convenience method for creating a DM convo.
  */
  bot._startDM = function (task, userId, cb) {
    bot.api.im.open({
      user: userId
    }, function (err, channel) {
      if (err) return cb(err)

      cb(null, task.startConversation({
        channel: channel.channel.id,
        user: userId
      }))
    })
  }

  bot.send = function (message, cb) {
    botkit.debug('SAY', message)

    /**
    * Construct a valid slack message.
    */
    var slackMessage = {
      type: message.type || 'message',
      channel: message.channel,
      text: message.text || null,
      username: message.username || null,
      parse: message.parse || null,
      link_names: message.link_names || null,
      attachments: message.attachments
        ? JSON.stringify(message.attachments)
        : null,
      unfurl_links: typeof message.unfurl_links !== 'undefined' ? message.unfurl_links : null,
      unfurl_media: typeof message.unfurl_media !== 'undefined' ? message.unfurl_media : null,
      icon_url: message.icon_url || null,
      icon_emoji: message.icon_emoji || null
    }
    bot.msgcount++

    if (message.icon_url || message.icon_emoji || message.username) {
      slackMessage.as_user = false
    } else {
      slackMessage.as_user = message.as_user || true
    }

    /**
    * These options are not supported by the RTM
    * so if they are specified, we use the web API to send messages.
    */
    cursor.horizontalAbsolute(0).eraseLine()
    if (message.attachments || message.icon_emoji || message.username || message.icon_url) {
      console.log(chalk.blue(JSON.stringify(message, null, 2)))
    } else {
      console.log(chalk.blue(message.text))
    }
    cl.prompt(chalk.grey(`${channel}> `))
  }

  bot.replyPublic = function (src, resp, cb) {
    if (!bot.res) {
      cb && cb('No web response object found')
    } else {
      var msg = {}

      if (typeof resp === 'string') {
        msg.text = resp
      } else {
        msg = resp
      }

      msg.channel = src.channel

      msg.response_type = 'in_channel'
      bot.res.json(msg)
      cb && cb()
    }
  }

  bot.replyPublicDelayed = function (src, resp, cb) {
    if (!src.response_url) {
      cb && cb('No response_url found')
    } else {
      var msg = {}

      if (typeof resp === 'string') {
        msg.text = resp
      } else {
        msg = resp
      }

      msg.channel = src.channel

      msg.response_type = 'in_channel'
      var requestOptions = {
        uri: src.response_url,
        method: 'POST',
        json: msg
      }
      request(requestOptions, function (err, resp, body) {
        /**
        * Do something?
        */
        if (err) {
          botkit.log.error('Error sending slash command response:', err)
          cb && cb(err)
        } else {
          cb && cb()
        }
      })
    }
  }

  bot.replyPrivate = function (src, resp, cb) {
    if (!bot.res) {
      cb && cb('No web response object found')
    } else {
      var msg = {}

      if (typeof resp === 'string') {
        msg.text = resp
      } else {
        msg = resp
      }

      msg.channel = src.channel

      msg.response_type = 'ephemeral'
      bot.res.json(msg)

      cb && cb()
    }
  }

  bot.replyPrivateDelayed = function (src, resp, cb) {
    if (!src.response_url) {
      cb && cb('No response_url found')
    } else {
      var msg = {}

      if (typeof resp === 'string') {
        msg.text = resp
      } else {
        msg = resp
      }

      msg.channel = src.channel

      msg.response_type = 'ephemeral'

      var requestOptions = {
        uri: src.response_url,
        method: 'POST',
        json: msg
      }
      request(requestOptions, function (err, resp, body) {
        /**
        * Do something?
        */
        if (err) {
          botkit.log.error('Error sending slash command response:', err)
          cb && cb(err)
        } else {
          cb && cb()
        }
      })
    }
  }

  bot.reply = function (src, resp, cb) {
    var msg = {}

    if (typeof resp === 'string') {
      msg.text = resp
    } else {
      msg = resp
    }

    msg.channel = src.channel

    bot.say(msg, cb)
  }

  /**
  * sends a typing message to the source channel
  *
  * @param {Object} src message source
  */
  bot.startTyping = function (src) {
    bot.reply(src, {
      type: 'typing'
    })
  }

  /**
  * replies with message after typing delay
  *
  * @param {Object} src message source
  * @param {(string|Object)} resp string or object
  * @param {function} cb optional request callback
  */
  bot.replyWithTyping = function (src, resp, cb) {
    var text

    if (typeof resp === 'string') {
      text = resp
    } else {
      text = resp.text
    }

    var typingLength = 1200 / 60 * text.length
    typingLength = typingLength > 2000 ? 2000 : typingLength

    bot.startTyping(src)

    setTimeout(function () {
      bot.reply(src, resp, cb)
    }, typingLength)
  }

  /**
  * This handles the particulars of finding an existing conversation or
  * topic to fit the message into...
  */
  bot.findConversation = function (message, cb) {
    botkit.debug('CUSTOM FIND CONVO', message.user, message.channel)
    if (message.type === 'message' || message.type === 'slash_command' ||
    message.type === 'outgoing_webhook') {
      for (var t = 0; t < botkit.tasks.length; t++) {
        for (var c = 0; c < botkit.tasks[t].convos.length; c++) {
          if (
            botkit.tasks[t].convos[c].isActive() &&
            botkit.tasks[t].convos[c].source_message.user === message.user &&
            botkit.tasks[t].convos[c].source_message.channel === message.channel
          ) {
            botkit.debug('FOUND EXISTING CONVO!')

            // modify message text to prune off the bot's name (@bot hey -> hey)
            // and trim whitespace that is sometimes added
            // this would otherwise happen in the handleSlackEvents function
            // which does not get called for messages attached to conversations.

            if (message.text) {
              message.text = message.text.trim()
            }

            var directMention = new RegExp(`\<\@${bot.identity.id}\>`, 'i')

            message.text = message.text.replace(directMention, '')
              .replace(/^\s+/, '').replace(/^:\s+/, '').replace(/^\s+/, '')

            cb(botkit.tasks[t].convos[c])
            return
          }
        }
      }
    }

    cb()
  }

  bot.res = {
    json: (obj) => { console.log(chalk.blue(JSON.stringify(obj, null, 2))) }
  }

  return bot
}

module.exports = function Shellbot (configuration) {
  let corebot = core(configuration || {})
  corebot.defineBot(worker)
  corebot.setupWebserver = function (port, cb) {
    corebot.webserver = express()
    corebot.webserver.use(bodyParser.json())
    corebot.webserver.use(bodyParser.urlencoded({ extended: true }))
    corebot.webserver.use(express.static(Path.resolve(__dirname, '/public')))

    corebot.webserver.listen(port, () => {
      corebot.log('** Starting webserver on port ' + port)
      if (cb) { cb(null, corebot.webserver) }
    })

    return corebot
  }

  corebot.on('message_received', (bot, msg) => {
    let evt
    if (msg.channel === 'DM') {
      evt = 'direct_message'
    } else {
      if (RegExp(`^@${bot.identity.name}`, 'i').test(msg.text)) {
        msg.text = msg.text.replace(RegExp(`^@${bot.identity.name}:?\\s*`, 'i'), '')
        console.log(chalk.red(msg.text))
        evt = 'direct_mention'
      } else if (RegExp(`@${bot.identity.name}`, 'i').test(msg.text)) {
        evt = 'mention'
      } else evt = 'ambient'
    }
    corebot.trigger(evt, [bot, msg])
  })

  return corebot
}
