/*
import { RefreshTokenModel, Token, RefreshToken, Callback, Falsey } from "oauth2-server";

// In-memory datastores:
const oauthAccessTokens: Token[] = [],
  oauthRefreshTokens: RefreshToken[] = [],
  oauthClients = [
    {
      clientId : 'thom',
      clientSecret : 'nightworld',
      redirectUri : ''
    }
  ],
  authorizedClientIds = {
    password: [
      'thom'
    ],
    refresh_token: [
      'thom'
    ]
  },
  users = [
    {
      id : '123',
      username: 'thomseddon',
      password: 'nightworld'
    }
  ];

const model:RefreshTokenModel = {
  // Debug function to dump the state of the data stores
  dump: function() {
    log("oauthAccessTokens", oauthAccessTokens);
    log("oauthClients", oauthClients);
    log("authorizedClientIds", authorizedClientIds);
    log("oauthRefreshTokens", oauthRefreshTokens);
    log("users", users);
  }


  getAccessToken: (accessToken: string, callback?: Callback<Token>): Promise<Token | Falsey> => {
    for(var i = 0, len = oauthAccessTokens.length; i < len; i++) {
      var elem = oauthAccessTokens[i];
      if(elem.accessToken === bearerToken) {
        return callback(false, elem);
      }
    }
    callback(false, false);
  }

  getRefreshToken: function (bearerToken, callback) {
    for(var i = 0, len = oauthRefreshTokens.length; i < len; i++) {
      var elem = oauthRefreshTokens[i];
      if(elem.refreshToken === bearerToken) {
        return callback(false, elem);
      }
    }
    callback(false, false);
  }

  getClient: function (clientId, clientSecret, callback) {
    for(var i = 0, len = oauthClients.length; i < len; i++) {
      var elem = oauthClients[i];
      if(elem.clientId === clientId &&
        (clientSecret === null || elem.clientSecret === clientSecret)) {
        return callback(false, elem);
      }
    }
    callback(false, false);
  }

  grantTypeAllowed: function (clientId, grantType, callback) {
    callback(false, authorizedClientIds[grantType] &&
      authorizedClientIds[grantType].indexOf(clientId.toLowerCase()) >= 0);
  }

  saveAccessToken: function (accessToken, clientId, expires, userId, callback) {
    oauthAccessTokens.unshift({
      accessToken: accessToken,
      clientId: clientId,
      userId: userId,
      expires: expires
    });

    callback(false);
  }

  saveRefreshToken: function (refreshToken, clientId, expires, userId, callback) {
    oauthRefreshTokens.unshift({
      refreshToken: refreshToken,
      clientId: clientId,
      userId: userId,
      expires: expires
    });

    callback(false);
  }

  getUser: function (username, password, callback) {
    for(var i = 0, len = users.length; i < len; i++) {
      var elem = users[i];
      if(elem.username === username && elem.password === password) {
        return callback(false, elem);
      }
    }
    callback(false, false);
  }
};


export default model;
*/
