/* Secure ruleset udpate mechanism
 * The contents of this file exist to provide HTTPS Everywhere with a secure mechanism
 * for updating the extension's database of rulesets.
 * This "module" handles the tasks of fetching an update.json[1] manifest and:
 * 1) determining whether an update to the ruleset library has been released, and
 * 2) verifyies that the update is authentic before applying the new ruleset.
 *
 * [1] The format and specification of the update.json file is detailed within a
 *     Github gist, at https://gist.github.com/redwire/2e1d8377ea58e43edb40
 *
 * The file https-everywhere/utils/ruleset_update_manifest.py exists to automate
 * part of the process of creating the update.json manifest data.
 */

/* ruleset update key
 * This is a hardcoded public key required to verify the signature over the
 * stringified update object within the whole update manifest object.
 */
// TODO
// Set this value.
const RULESET_UPDATE_KEY = '';

/* release date preference key
 * This is the key used to set and obtain the date value of the most recently
 * downloaded ruleset release as a preference.
 */
const UPDATE_PREF_DATE = 'ruleset_release_date';

/* RulesetUpdate
 * Provides the functionality of obtaining, verifying the authenticity of, and
 * applying updates.
 * updateManifestSource - the URL from which the update.json file is fetched.
 *                        e.g. https://eff.org/files/https-everywhere/update.json
 */
// TODO
// Move class instances into only the functions they are needed in.
// Leave them here for a reference for now.
function RulesetUpdater(updateManifestSource) {
  this.unzip = Cc['@mozilla.org/libjar/zip-reader;1'].createInstance(Ci.nsIZipReader);
  this.manifestSrc = updateManifestSource;
}

/* Prototype functionality notes
 * verifyUpdateSignature 
 *   The hash can be initialized to use MD2, MD5, SHA1, SHA256, SHA384, or SHA512
 */
RulesetUpdater.prototype = {
  log: function(level, msg) {
    https_everywhereLog(level, msg);  
  },
  fetchUpdate: function() {
    var xhr = new XMLHttpRequest();
    xhr.open('get', this.manifestSrc, true);
    xhr.onreadystatechange = function() {
      var status;
      var data;
      if (xhr.readyState === 4) { // complete
        status = xhr.status;
        if (status === 200) { // OK
          data = JSON.parse(xhr.responseText);
          this.conditionallyApplyUpdate(data);
        } else {
          this.log(WARN, 'Could not fetch update manifest at ' + this.manifestSrc);
        }
      }
    };
    xhr.send();
  },
  conditionallyApplyUpdate: function(updateObj) {
    var validSignature = verifyUpdateSignature(
                           JSON.stringify(updateObj.update),
                           updateObj.update_signature);
    if (!validSignature) {
      this.log(WARN, 'Validation of the update signature provided failed');
      return; // Not an authentic release!
    }
    var newVersion = parseFloat(updateObj.update.date);
    if (isNaN(newVersion)) {
      this.log(WARN, 'date field in update JSON (' + updateObj.update.date + ') not valid format');
      return; // Cannot determine whether update is new with invalid date field.
    }
    // TODO
    // Make sure this is the correct way to persistently store this data.
    var currentVersion = HTTPSEverywhere.instance.prefs.getFloatPref(UPDATE_PREF_DATE);
    if (newVersion <= currentVersion) {
      return; // No new version to download.
    }
    // Fetch the zipped DB file
    // Unzip the DB file
    // Check the hash of the file obtained matches the one in the updateObj
    // Apply the changes
    HTTPSEverywhere.instance.prefs.setFloatPref(UPDATE_PREF_DATE, newVersion);
  },
  verifyUpdateSignature: function(updateStr, signature) {
    var checkHash = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);
    var verifier = Cc['@mozilla.org/security/datasignatureverifier;1']
                     .createInstance(Ci.nsIDataSignatureVerifier);
    var data = convertString(updateStr, 'UTF-8');
    checkHash.init(checkHash.SHA1);
    checkHash.update(data, data.length);
    var hash = checkHash.finish(false);
    return verifier.verifyData(hash, signature, RULESET_UPDATE_KEY);
  },
  convertString: function(str, encoding) {
    var converter = Cc['@mozilla.org/intl/scriptableunicodeconverter']
                      .createInstance(ci.nsIScriptableUnicodeConverter);
    converter.charset = encoding;
    var result = {}; // An out paramter used by converter.convertToByteArray.
    var data = converter.convertToByteArray(updateStr, result);
    return data;
  }
};
