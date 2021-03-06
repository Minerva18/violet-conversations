/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

/**
 * This is the Core Violet Module - it returns the conversation engine that
 * voice scripts can take advantage of.
 * <br><br>
 * Voice scripts can be grouped into a single app and multiple apps can be made
 * available on a single server. Currently Violet only supports registering
 * intents for Amazon's Alexa Skills Kit.
 *
 * @module violet
 */

var path = require('path');

var ConversationEngine = require('./conversationEngine.js');


///////////
///////////

var appName = null; // set when loading a set of scripts
var appToVioletConversationEngines = {};

/**
 * Assists with the loading of scripts by the Violet Server. Primarily enables
 * apps to have multiple scripts.
 */
module.exports.server = function() {
  return {
    loadScript: (contextDir, scriptPath, name, svcRouter) => {
      appName = name;
      require(path.join(contextDir, scriptPath));
      const script = module.exports.script();
      script.registerIntents();
      script.platform.setServerApp(svcRouter);
      return script;
    },
    loadMultipleScripts: (contextDir, scriptPaths, name, svcRouter) => {
      appName = name;
      scriptPaths.forEach(p=>{
        // all instances of script below should be identical
        require(path.join(contextDir, p));
      })
      const script = module.exports.script();
      script.registerIntents();
      script.platform.setServerApp(svcRouter);
      return script;
    }
  };
}
/**
 * Violet intentionally groups scripts into an app. The method clears any
 * previous script information for the specified app. This
 * method is primarily used by the test suite as it uses the same app repeatedly.
 *
 * @param appName - App name to reset script information.
 */
module.exports.clearAppInfo = function(_appName) {
  delete appToVioletConversationEngines[_appName];
};
/**
 * Instantiates and returns the Violet Conversation Engine. Most violet scripts
 * start by making this call.
 *
 * @param appName - (optional) App name to attach this script to. Not setting this
 * parameter will mean that Violet will attach this script to the previous App. It is
 * recommended to not set this parameter (in the script) but to define it
 * in the parent where the script is being loaded.
 * @param Platform - (optional) Voice Platform to support (Alexa or Google). Not setting this
 * parameter will mean that Violet will support Alexa.
 * @param svcEndpoint - (optional) Service Endpoint to use. Not setting this
 * parameter will mean that Violet will use 'alexa'.
 * @returns {ConversationEngine} - The primary
 * {@link module:conversationEngine~ConversationEngine ConversationEngine} that scripts will be defining
 * intents, goals, etc against.
 */
module.exports.script = function(_appName, Platform, svcEndpoint) {
  if (Platform == null) Platform = require('./alexaPlatform.js');
  if (appName == null && _appName != null) appName = _appName;
  if (appName == null) {
    // allow scripts to be launched without the server and instead just initialize after 1s
    if (svcEndpoint == null) svcEndpoint = 'alexa'
    var violetSrvr = require('./violetSrvr.js')('/' + svcEndpoint);
    var srvrInstance = violetSrvr.createAndListen(process.env.PORT || 8080);
    appName = 'local'
    setTimeout(()=>{ // run after the full script loads
      violet.registerIntents();
      violet.platform.setServerApp(violetSrvr.getSvcRouter());
      violetSrvr.displayScriptInitialized(srvrInstance, violet);
    }, 1*1000);
  }
  if (appToVioletConversationEngines[appName]) return appToVioletConversationEngines[appName];

  var voicePlatform = new Platform(appName);
  var violet = new ConversationEngine(voicePlatform);

  if (violet.convo.closeRequests) {
    violet.respondTo({
      name: 'closeSession',
      expecting: violet.convo.closeRequests,
      resolve: (response) => {
        response.clearAllGoals();
        response.endConversation();
    }});
  }

  appToVioletConversationEngines[appName] = violet;
  return violet;
};
