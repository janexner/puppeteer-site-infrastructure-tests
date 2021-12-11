'use strict';

const { Before, Given, When, Then, After, setDefaultTimeout } = require('@cucumber/cucumber');
const puppeteer = require('puppeteer');
const fs = require('fs');

setDefaultTimeout(1000 * 30); // 30s timeout for loading pages

Before(async function() {
    const browser = await puppeteer.launch({ headless: true, slowMo: 50 });
    const page = await browser.newPage();
    this.browser = browser;
    this.page = page;
    // Check if folder exists before writing files there
    const dataDirectory = './timing/';
    if (!fs.existsSync(dataDirectory)) {
        fs.mkdirSync(dataDirectory);
    }
    var logStream = fs.createWriteStream(dataDirectory + 'timings.csv', {'flags': 'a'});
    this.logStream = logStream;
});

After(async function() {
    // Teardown browser
    if (this.browser) {
        await this.browser.close();
    }
    // Cleanup write stream for logger
    if (this.logStream) {
        await this.logStream.close();
    }
});

Given(/^the page \"(.*)\" is loaded$/, function (pageURL) {
    return this.page.goto(pageURL, {waitUntil: 'networkidle2'});
});

When(/^the snippet \"(.*)\" is executed$/, function(snippet) {
    return this.page.evaluate(snippet);
});

Given(/^we wait for (\d+) seconds?$/, function(seconds) {
    return new Promise(resolve => {
        setTimeout(resolve, seconds)
    });
});

Then(/^the snippet \"(.*)\" evaluates to true$/, function(snippet) {
    return this.page.evaluate(snippet);
});

// data layer tests

Then(/^the \"(.*)\" data layer element is \"(.*)\"$/, function(dataLayerElementName, dataLayerElementValue) {
    const snippet = "(" + dataLayerElementName + " === '" + dataLayerElementValue + "')";
    return this.page.evaluate(snippet);
});

Then(/^the \"(.*)\" data layer element is (\d+)$/, function(dataLayerElementName, dataLayerElementValue) {
    return this.page.evaluate("(" + dataLayerElementName + " === " + dataLayerElementValue + ")");
});

Then(/^there is a data layer element called \"(.*)\"$/, function(elementName) {
    return this.page.evaluate("('undefined' !== typeof " + elementName + ")");
});
Then(/^the \"(.*)\" data layer element exists$/, function(elementName) {
    return this.page.evaluate("('undefined' !== typeof " + elementName + ")");
});

// DOM tests

Then(/^the DOM element \"(.*)\" exists$/, function(cssSelector) {
    return this.page.evaluate("('undefined' !== typeof document.querySelector('" + cssSelector + "'))");
});
Then(/^the DOM element \"(.*)\" exists (\d+) times$/, function(cssSelector, instances) {
    return this.page.evaluate("document.querySelectorAll('" + cssSelector + "').length").then(function(actualInstances) {
        return (instances == actualInstances);
    });
});

// Adobe Experience Cloud tests

Then(/^Launch is present$/, async function() {
    const snippet = "(typeof _satellite !== 'undefined' && _satellite && typeof _satellite.buildInfo !== 'undefined' && _satellite.buildInfo)";
    return this.page.evaluate(snippet);
});
Then(/^the Launch property is called \"(.*)\"$/, function(propertyName) {
    const snippet = "(typeof _satellite !== 'undefined' && _satellite && typeof _satellite.property !== 'undefined' && _satellite.property && 'undefined' !== _satellite.property.name && _satellite.property.name === '" + propertyName + "')";
    return this.page.evaluate(snippet);
});

Then(/^(?:MCID|ECID|Experience Cloud ID Service) is present$/, function() {
    return this.page.evaluate("(typeof Visitor === 'function')");
});
Then(/^(?:MCID|ECID|Experience Cloud ID Service) version is \"(.*)\" or later$/, function(targetVersion) {
    const snippet = "var result = 'unavailable'; if ('undefined' !== typeof Visitor) { if ('undefined' !== typeof Visitor.version) { result = Visitor.version; } else { for (vv in s_c_il) { var nvv = s_c_il[vv]; if (typeof nvv._c !== 'undefined' && nvv._c == 'Visitor') { result = nvv.version; break;} } } }; result;";
    return this.page.evaluate(snippet).then(function(ecidVersion) {
        const cv = compareVersion(ecidVersion, targetVersion);
        if (0 === cv || 1 == cv) {
            return true;
        } else {
            return false;
        }
    });
});
Then(/^(?:MCID|ECID|Experience Cloud ID Service) version is below \"(.*)\"$/, function (targetVersion) {
    const snippet = "var result = 'unavailable'; if ('undefined' !== typeof Visitor) { if ('undefined' !== typeof Visitor.version) { result = Visitor.version; } else { for (vv in s_c_il) { var nvv = s_c_il[vv]; if (typeof nvv._c !== 'undefined' && nvv._c == 'Visitor') { result = nvv.version; break;} } } }; result;";
    return this.page.evaluate(snippet).then(function(ecidVersion) {
        const cv = compareVersion(ecidVersion, targetVersion);
        if (-1 == cv) {
            return true;
        } else {
            return false;
        }
    });
});

Then(/^(?:AA|Adobe Analytics) is present$/, function() {
    return this.page.evaluate("(typeof AppMeasurement == 'function' || typeof s_gi == 'function')");
});
Then(/^(?:AA|Adobe Analytics) lib type is \"(.*)\"$/, function(libType) {
    const snippet = "(typeof AppMeasurement == 'function' ) ? 'AppMeasurement' : (typeof s_gi == 'function') ? 'legacy' : 'none';";
    return this.page.evaluate(snippet).then(function(aaLibType) {
        if (aaLibType === libType) {
            return true;
        }
        return false;
    });
});
Then(/^(?:AA|Adobe Analytics) version is \"(.*)\" or later$/, function(targetVersion) {
    const snippet = "(typeof AppMeasurement !== 'undefined') ? AppMeasurement.toString().match(/\.version=\"(.*?)\"/)[1] : (typeof s_gi !== 'undefined') ? s_gi.toString().match(/\.version='(.*?)'/)[1] : 'unavailable';";
    return this.page.evaluate(snippet).then(function(ecidVersion) {
        const cv = compareVersion(ecidVersion, targetVersion);
        if (0 === cv || 1 == cv) {
            return true;
        } else {
            return false;
        }
    });
});

Then(/^latest (?:AA|Adobe Analytics) tracking call contains key \"(.*)\" with value \"(.*)\"$/, function(key, value) {
    const snippet = "var entryList = performance.getEntriesByType('resource');var result = false;for (var i = entryList.length - 1; i > 0; i--) {if ('undefined' !== typeof entryList[i].name && entryList[i].name.indexOf('/b/ss/') >= 0) {var keys = entryList[i].name.split('&');for (var j = keys.length - 1; j > 0; j--) {var tmp = keys[j].split('=');if ('" + key + "' === tmp[0]) {if ('" + value + "' === decodeURIComponent(tmp[1])) {result = true;break;}}}}} result;";
    return this.page.evaluate(snippet);
});

Then(/^(?:AT|Adobe Target) is present$/, function() {
    return this.page.evaluate("(('undefined' !== typeof adobe && adobe && 'undefined' !== typeof adobe.target && adobe.target) || (typeof TNT == 'object'))");
});
Then(/^(?:AT|Adobe Target) lib type is \"(.*)\"$/, function(libType) {
    const snippet = "(typeof mboxVersion !== 'undefined' ) ? 'legacy' : (typeof adobe !== 'undefined' && typeof adobe.target !== 'undefined' && typeof adobe.target.VERSION !== 'undefined') ? 'at.js' : 'none';";
    return this.page.evaluate(snippet).then(function(atLibType) {
        if (atLibType === libType) {
            return true;
        }
        return false;
    });
});
Then(/^(?:AT|Adobe Target) version is \"(.*)\" or later$/, function(targetVersion) {
    const snippet = "('undefined' !== typeof mboxVersion) ? mboxVersion : (typeof adobe !== 'undefined' && typeof adobe.target !== 'undefined' && typeof adobe.target.VERSION !== 'undefined') ? adobe.target.VERSION : 'unavailable'";
    return this.page.evaluate(snippet).then(function(atVersion) {
        const cv = compareVersion(atVersion, targetVersion);
        if (0 === cv || 1 == cv) {
            return true;
        } else {
            return false;
        }
    });
});
// Then(/^an (?:AT|Adobe Target) mbox named \"(.*)\" exists $/, function(mboxName) {});

// non-Adobe tools tests

Then(/^jQuery is present$/, function() {
    return this.page.evaluate("('undefined' !== typeof jQuery)");
});
Then(/^the jQuery version is \"(.*)\" or later$/, function(targetVersion) {
    const snippet = "'undefined' !== typeof jQuery ? jQuery.fn.jquery : 'unavailable'";
    return this.page.evaluate(snippet).then(function(jQueryVersion) {
        const cv = compareVersion(jQueryVersion, targetVersion);
        if (0 === cv || 1 === cv) {
            return true;
        } else {
            return false;
        }
    });
});
Then(/^the jQuery version is below \"(.*)\"$/, function(targetVersion) {
    const snippet = "'undefined' !== typeof jQuery ? jQuery.fn.jquery : 'unavailable'";
    return this.page.evaluate(snippet).then (function(jQueryVersion) {
        const cv = compareVersion(jQueryVersion, targetVersion);
        if (-1 === cv) {
            return true;
        } else {
            return false;
        }
    });
});

// other tests (experimental)

Then(/^GTM is present$/, function() {
    return this.page.evaluate("(typeof google_tag_manager === 'object')");
});

Then(/^Ensighten Manage is present$/, function() {
    return this.page.evaluate("(typeof Bootstrapper === 'object')");
});

Then(/^Tealium IQ is present$/, function() {
    return this.page.evaluate("(typeof utag === 'object')");
});

Then(/^log Browser Performance Timing$/, function() {
    var someFn = function (ls, pa, pu) {
        return (function () {
            pa.evaluate("JSON.stringify(performance.timing)").then(function (res) {
                ls.write("" + pu + ": " + res + "\n");
            }, function (val) {
                // nothing to do here
            });
        });
    }
    var run = someFn(this.logStream, this.page, this.page.url());
    run();
    return true;
});

// helpers



function compareVersion(v1, v2) {
    if (typeof v1 !== 'string') return false;
    if (typeof v2 !== 'string') return false;
    v1 = v1.split('.');
    v2 = v2.split('.');
    const k = Math.min(v1.length, v2.length);
    for (let i = 0; i < k; ++ i) {
        v1[i] = parseInt(v1[i], 10);
        v2[i] = parseInt(v2[i], 10);
        if (v1[i] > v2[i]) return 1;
        if (v1[i] < v2[i]) return -1;        
    }
    return v1.length == v2.length ? 0: (v1.length < v2.length ? -1 : 1);
}
