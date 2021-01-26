
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

This application replaces the manual process, by automating the login process via the puppeteer-extra stealth plug-in and then scanning the resultant network traffic for the items outlined above. It then stores the results in the nestGoogleAuth.json file which can be copied into the appropriate place in your ~/.homebridge.config.json file.

# Installation

prequisites: node ~10, npm. All others are installed during install process.

	git clone https://github.com/felipeazucares/nest-GoogleAuth.git
    cd nest-GoogleAuth.git
    npm install

# Configuration

The items that we want to collect from the network traffic during the login process are specified in the `config.json`. The one supplied with the application are complete/correct as of publishing:  

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
 - `headerToReturn` [optional] the header that will be returned and stored in the googleAuth.json file. 
 - `propertyToMatch2` [optional] second property that were checking for the existence of. 
 - `subPropertyToReturn` [optional] if second `propertyToMatch2` is detected which property do we want to return. 
 - `headerKey` is the key to assign to the `headerToReturn` value in the googleAuth.json
   file.
  
Note: that the application supports three types of filter. If `headerToReturn` is not specified then the network traffic monitoring returns the propertyToMatch value with the `headerKey` specified. This is because sometimes (e.g. issueToken) we don't want to to return a header from the intercepted traffic, just the intercepted traffic itself. Finally, if `propertyToMatch2` is specified then `eventType` traffic is scanned for the existence of `propertyToMatch2`, any traffic with this property (and a matching `stringToFin` in its `propertyToMatch` property has its `propertyToReturn` property stored int he googleAuth.json, assuming it exists.  

# Usage

    node nestAuth.js u=yourGoogleUserId p=yourGooglePassword

    The result of the property collection is displayed in JSON format when the job is complete. It is also stored in the googleAuth.json file in the application directory. The results can be pasted into the Homebridge config.json taking care to omit any enclosing quotation marks.

# License
This code is licensed under the terms of the MIT license.
