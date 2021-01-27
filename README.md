
# nest-GoogleAuth

**Application to automate collection of the tokens, cookies and API key required to connect a Nest plug-in to the Homebridge application.**

Since August 2019 connecting your nest plug-in to Homebridge requires that you authenticate via a Google account login. As the Nest plug-in documentation points out:

Google Accounts are configured using the `"googleAuth"` object in `config.json`, which contains three fields, `"issueToken"`, `"cookies"` and `"apiKey"`, and looks like this:
 
```

"platform": "Nest",
"googleAuth": {
    "issueToken": "https://accounts.google.com/o/oauth2/iframerpc?action=issueToken...",
    "cookies": "OCAK=TOMPYI3cCPAt...; SID=ogftnk...; HSID=ApXSR...; ...; SIDCC=AN0-TYt...",
    "apiKey": "AIzaS..."
},

```

The values of `"issueToken"`, `"cookies"` and `"apiKey"` are specific to your Google Account.

Currently the only way to get these items is to requires a 14 step process and access to browser dev tools which is a pain, plus you need to repeat it if you log out of your Google account.  

This application replaces the manual process, by automating the login process via the puppeteer-extra stealth plug-in and then scanning the resultant network traffic for the items outlined above. It then stores the results in the googleAuth.json file which can be copied into the appropriate place in your ~/.homebridge/config.json file.

# Installation

Prequisites: node ~14, npm. All others are installed during install process.

	git clone https://github.com/felipeazucares/nest-GoogleAuth.git
    cd nest-GoogleAuth.git
    npm install

# Configuration

The items that we need to collect from the network traffic during the google login process are specified in the applications `config.json`. The settings provided should be complete/correct as of January 2021:  

```
{
  "issueToken": {
    "eventType": "Network.requestWillBeSent",
    "objectType": "request",
    "propertyToMatch": "url",
    "stringToFind": "issueToken",
    "headerKey": "issueToken"
  },
  "cookies": {
    "eventType": "Network.responseReceived",
    "objectType": "response",
    "propertyToMatch": "url",
    "stringToFind": "oauth2/iframe",
    "propertyToMatch2": "requestHeaders",
    "subPropertyToReturn": "cookie",
    "headerKey": "cookies"
  },
  "apiKey": {
    "eventType": "Network.requestWillBeSent",
    "objectType": "request",
    "propertyToMatch": "url",
    "stringToFind": "issue_jwt",
    "headerToReturn": "x-goog-api-key",
    "headerKey": "apikey"
  },
  "debug": false
}

```
 - `eventType` is the type of network traffic being intercepted. Options are "Network.requestWillBeSent" & "Network.responseReceived".
 - `objectType` is 'request' or 'response'.
 - `propertyToMatch` is the name of the property within the specified `objectType` that we're filtering by. 
 - `stringToFind` value that we're looking for within`proprtyToMatch`. 
 - `headerToReturn` [optional] if we are after a header, then name it here. 
 - `propertyToMatch2` [optional] If we're checking for a different property of the item we're tracking in propertyToMatch then name it here. 
 - `subPropertyToReturn` [optional] if second `propertyToMatch2` is detected which property do we want to return and store. 
 - `headerKey` is the key to assign to the value we're returning in the googleAuth.json
   file.
  
Note: that the application supports three types of filter.

1. If `headerToReturn` is not specified then the network traffic monitoring returns traffic with a propertyToMatch value that matches what is specified in the `stringToFind` property, and names it whatever we have specified in the `headerKey`. This is because sometimes (e.g. issueToken) we don't want to return a header from the intercepted traffic, just the intercepted traffic itself. 
2. If `headerToReturn *is* provided, then the monitor collects traffic with a propertyToMatch value that matches what is specified in `stringToFind` and returns the property specified in the `headerToReturn` field, as the name specified in the `headerKey`.
3. Finally, if `propertyToMatch2` is specified then the `propertyToMatch` of incoming traffic is filtered for the `stringToMatch`. The remaining traffic is then checked for the existence of `propertyToMatch2`, returning any item's `propertyToReturn` value, named as per the `headerKey` field. 

# Usage

    node nestAuth.js u=yourGoogleUserId p=yourGooglePassword

    The result of the property collection is displayed in JSON format when the job is complete. It is also stored in the googleAuth.json file in the application directory. The results can be pasted into the Homebridge config.json taking care to omit any enclosing quotation marks.

# License
This code is licensed under the terms of the MIT license.
