
/**
 * almond 0.2.0 Copyright (c) 2011, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        aps = [].slice;

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (waiting.hasOwnProperty(name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!defined.hasOwnProperty(name) && !defining.hasOwnProperty(name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (defined.hasOwnProperty(depName) ||
                           waiting.hasOwnProperty(depName) ||
                           defining.hasOwnProperty(depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 15);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        return req;
    };

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        waiting[name] = [name, deps, callback];
    };

    define.amd = {
        jQuery: true
    };
}());

define("almond",[], function(){});

/*! URL.js - v1.2.2 - 2012-10-22
* https://github.com/stevoland/URL.js
 Licensed MIT */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define('URL',[], factory);
    } else {
        root.URL = factory();
    }
}(this, function () {

    var options = {
        strictMode: false,
        key: [
            "source",
            "protocol",
            "authority",
            "userInfo",
            "user",
            "password",
            "host",
            "port",
            "relative",
            "path",
            "directory",
            "file",
            "query",
            "anchor"
        ],
        q: {
            name:   "queryKey",
            parser: /(?:^|&)([^&=]*)=?([^&]*)/g
        },
        parser: {
            strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
            loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
        }
    };


    /**
     * Parse a URI into an object
     * Credit: http://blog.stevenlevithan.com/archives/parseuri
     *
     * @param  {string} str     URI to parse
     * @return {object}         URI object
     */
    function parse (str) {
        var o   = options,
            m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
            uri = {},
            i   = 14;

        while (i--) {
            uri[o.key[i]] = m[i] || "";
        }

        uri[o.q.name] = {};
        uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
            if ($1) {
                uri[o.q.name][$1] = $2;
            }
        });

        return uri;
    }


    /**
     * Build a URI from an object
     * Credit: https://gist.github.com/1073037
     *
     * @param  {object} u       URI object
     * @return {string}         URI
     */
    function make (u) {

        var uri = "",
            k;

        if (u.protocol) {
            uri += u.protocol + "://";
        }

        if (u.user) {
            uri += u.user;
        }

        if (u.password) {
            uri += ":" + u.password;
        }

        if (u.user || u.password) {
            uri += "@";
        }

        if (u.host) {
            uri += u.host;
        }

        if (u.port) {
            uri += ":" + u.port;
        }

        if (u.path) {
            uri += u.path;
        }

        var qk = u.queryKey;
        var qs = [];

        for (k in qk) {

            if (!qk.hasOwnProperty(k)) {
                continue;
            }

            var v = encodeURIComponent(qk[k]);

            k = encodeURIComponent(k);

            if (v) {
                qs.push(k + "=" + v);
            } else {
                qs.push(k);
            }
        }

        if (qs.length > 0) {
            uri += "?" + qs.join("&");
        }

        if (u.anchor) {
            uri += "#" + u.anchor;
        }

        return uri;
    }

    return {
        parse: parse,
        make: make
    };

}));
/*! DOMTrigger.js - v0.1.0 - 2012-10-22
* https://github.com/stevoland/DOMTrigger.js
 Licensed MIT */

(function (root, factory, d) {
	if (typeof exports === 'object') {
		module.exports = factory();
	} else if (typeof define === 'function' && define.amd) {
		define('DOMTrigger',[], factory);
	} else {
		root.returnExports = factory();
	}
}(this, function () {

	var eventMatchers = {
			'HTMLEvents': /^(?:load|unload|abort|error|select|change|submit|reset|focus|blur|resize|scroll)$/,
			'MouseEvents': /^(?:click|dblclick|mouse(?:down|up|over|move|out))$/
		},
		defaultOptions = {
			pointerX: 0,
			pointerY: 0,
			button: 0,
			ctrlKey: false,
			altKey: false,
			shiftKey: false,
			metaKey: false,
			bubbles: true,
			cancelable: true
		};

	function extend (destination, source) {
		for (var property in source) {
			destination[property] = source[property];
		}

		return destination;
	}

	/**
	 * Trigger a HTMLEvent or MouseEvent
	 * Credit: http://stackoverflow.com/a/6158050
	 *
	 * @private
	 * @param  {HTMLElement} element     The target element
	 * @param  {string}      eventName   Event type
	 * @param  {object}      ...         [optional] event object
	 * @return {HTMLElement}             The target element
	 */
	function DOMTrigger (element, eventName)
	{
		var options = extend(defaultOptions, arguments[2] || {}),
			oEvent, eventType = null,
			d = document;

		for (var name in eventMatchers) {
			if (eventMatchers[name].test(eventName)) { eventType = name; break; }
		}

		if (!eventType) {
			throw new SyntaxError('Only HTMLEvents and MouseEvents interfaces are supported');
		}

		if (d.createEvent) {
			oEvent = d.createEvent(eventType);
			if (eventType === 'HTMLEvents') {
				oEvent.initEvent(eventName, options.bubbles, options.cancelable);
			}
			else {
				oEvent.initMouseEvent(eventName, options.bubbles, options.cancelable, d.defaultView,
					options.button, options.pointerX, options.pointerY, options.pointerX, options.pointerY,
					options.ctrlKey, options.altKey, options.shiftKey, options.metaKey, options.button, element);
			}
			oEvent = extend(oEvent, options);
			element.dispatchEvent(oEvent);
		}
		else {
			options.clientX = options.pointerX;
			options.clientY = options.pointerY;
			var evt = d.createEventObject();
			oEvent = extend(evt, options);
			element.fireEvent('on' + eventName, oEvent);
		}
		return element;
	}

	return DOMTrigger;
}));
/*! CSSelector.js - v0.1.0 - 2012-10-22
* https://github.com/stevoland/CSSelector.js
* Copyright (c) 2012 stevo (Stephen Collings); Licensed MIT */

(function (root, factory) {
	if (typeof exports === 'object') {
		module.exports = factory();
	} else if (typeof define === 'function' && define.amd) {
		define('CSSelector',[], factory);
	} else {
		root.returnExports = factory();
	}
}(this, function () {

	/**
	 * Generate a CSS selector string to target the given node
	 *
	 * @param  {HTMLElement} el     Node to target
	 * @return {string}             CSS selector
	 */
	function CSSelector (el) {
		var names = [];
		while (el.parentNode) {
			if (el.id) {
				names.unshift('#' + el.id);
				break;
			} else {
				if (el === el.ownerDocument.documentElement || el === el.ownerDocument.body) {
					names.unshift(el.tagName);
				} else {
					for (var c = 1, e = el; e.previousElementSibling; e = e.previousElementSibling, c++) {}
					names.unshift(el.tagName + ':nth-child(' + c + ')');
				}
				el = el.parentNode;
			}
		}
		return names.join(' > ');
	}

	return CSSelector;
}));
// Copyright (c) 2012 Florian H., https://github.com/js-coder https://github.com/js-coder/cookie.js
!function(a,b){var c={isArray:Array.isArray||function(a){return Object.prototype.toString.call(a)==="[object Array]"},isPlainObject:function(a){return Object.prototype.toString.call(a)==="[object Object]"},toArray:function(a){return Array.prototype.slice.call(a)},getKeys:Object.keys||function(a){var b=[],c="";for(c in a)a.hasOwnProperty(c)&&b.push(c);return b},escape:function(a){return a.replace(/[,;"\\=\s%]/g,function(a){return encodeURIComponent(a)})},retrieve:function(a,c){return a===b?c:a}},d=function(){return d.get.apply(d,arguments)};d.defaults={},d.expiresMultiplier=86400,d.set=function(d,e,f){if(c.isPlainObject(d))for(var g in d)d.hasOwnProperty(g)&&this.set(g,d[g],e);else{f=c.isPlainObject(f)?f:{expires:f};var h=f.expires!==b?f.expires:this.defaults.expires||"",i=typeof h;i==="string"&&h!==""?h=new Date(h):i==="number"&&(h=new Date(+(new Date)+1e3*this.expiresMultiplier*h)),h!==""&&"toGMTString"in h&&(h=";expires="+h.toGMTString());var j=f.path||this.defaults.path;j=j?";path="+j:"";var k=f.domain||this.defaults.domain;k=k?";domain="+k:"";var l=f.secure||this.defaults.secure?";secure":"";a.cookie=c.escape(d)+"="+c.escape(e)+h+j+k+l}return this},d.remove=function(a){a=c.isArray(a)?a:c.toArray(arguments);for(var b=0,d=a.length;b<d;b++)this.set(a[b],"",-1);return this},d.empty=function(){return this.remove(c.getKeys(this.all()))},d.get=function(a,d){d=d||b;var e=this.all();if(c.isArray(a)){var f={};for(var g=0,h=a.length;g<h;g++){var i=a[g];f[i]=c.retrieve(e[i],d)}return f}return c.retrieve(e[a],d)},d.all=function(){if(a.cookie==="")return{};var b=a.cookie.split("; "),c={};for(var d=0,e=b.length;d<e;d++){var f=b[d].split("=");c[decodeURIComponent(f[0])]=decodeURIComponent(f[1])}return c},d.enabled=function(){if(navigator.cookieEnabled)return!0;var a=d.set("_","_").get("_")==="_";return d.remove("_"),a},typeof define=="function"&&define.amd?define('cookie',[],function(){return d}):typeof exports!="undefined"?exports.cookie=d:window.cookie=d}(document);
define('client',[
	'URL',
	'DOMTrigger',
	'CSSelector',
	'cookie'
], function (URL, simulateEvent, getCSSelector, cookie) {

	var SOCKET_IO_PATH = '/socket.io/socket.io.js',
		socket,
		winURIObj,
		key,
		w,
		d,
		isDriver = false;

	cookie.expiresMultiplier = 1;


	/**
	 * Clean an event for sending to socket.io.
	 * - Remove complex objects
	 * - Replace HTMLElements with CSS selectors
	 * - Replace window and document references with placeholders
	 * - If the target or an ancestor is an anchor, include the href
	 *     in case the target can't be found on another client instance
	 *
	 * @private
	 * @param  {Event} ev Event object
	 */
	function sendEvent (ev) {
		var e = ev || w.event,
			e2 = {
				gsElements: [],
				gsDocuments: [],
				gsWindows: [],
				gsURI: getHrefFromNode(e.target),
				gsSimulated: true
			},
			i;

		if (e.gsSimulated) {
			return true;
		}

		for (i in e) {
			if (i === 'originalTarget' || i === 'rangeParent' ) {
				// Firefox throws errors from text inputs due to XUL elements
				// ignore these
			} else if (e[i] instanceof HTMLElement) {
				e2[i] = getCSSelector(e[i]);
				e2.gsElements.push(i);
			} else if (e[i] === d) {
				e2[i] = 'document';
				e2.gsDocuments.push(i);
			} else if (e[i] === w) {
				e2[i] = 'window';
				e2.gsWindows.push(i);
			} else if (e[i] === null) {
				e2[i] = e[i];
			} else if (typeof e[i] === 'function' || typeof e[i] === 'object') {
				// ignore other complex objects
			} else {
				e2[i] = e[i];
			}
		}
		
		socket.emit('event', e2);
	}


	/**
	 * Convert a cleaned event from socket.io into a real event and fire it
	 * - Replace CSS selectors with HTMLElements
	 * - Replace window and document placeholders with real references
	 * - If any elements can't be found but a URI is included, fall back to
	 *     using that
	 *
	 * @private
	 * @param  {Event} ev Event object
	 */
	function receiveEvent (e) {
		var i,
			elementsFound = true;

		if (e.gsElements) {
			i = e.gsElements.length;
			while (i--) {
				e[e.gsElements[i]] = d.querySelector(e[e.gsElements[i]]);
				if (e[e.gsElements[i]] === null) {
					elementsFound = false;
				}
			}
			delete e.gsElements;
		}
		if (e.gsDocuments) {
			i = e.gsDocuments.length;
			while (i--) {
				e[e.gsDocuments[i]] = d;
			}
			delete e.gsDocuments;
		}
		if (e.gsWindows) {
			i = e.gsWindows.length;
			while (i--) {
				e[e.gsWindows[i]] = w;
			}
			delete e.gsWindows;
		}

		if (elementsFound) {
			e.gsSimulated = true;
			if (e.type === 'change') {
				receiveChangeEvent(e);
			} else {
				simulateEvent(e.originalTarget || e.target, e.type, e);
			}
		} else if (e.gsURI) {
			w.location = e.gsURI;
		}
	}

	function receiveChangeEvent (e) {
		e.target.value = e.value;
	}

	/**
	 * If a node or an ancestor is an anchor return the href or null
	 *
	 * @private
	 * @param  {HTMLElement} node The node
	 * @return {string}      The anchor's href or null
	 */
	function getHrefFromNode (node) {
		var anchor,
			href;

		while (node) {
			if (node.nodeName.toUpperCase() === 'A') {
				anchor = node;
				break;
			} else {
				node = node.parentNode;
			}
		}

		if (anchor && anchor.href) {
			href = anchor.href;
		}

		return href;
	}


	function onClickHandler (e) {
		// Set a flag cookie for 5 seconds. If the file is loaded and this cookie is present, we assume that the
		// load was the result of the click and not a page refresh (we have no proper way of knowing this) so know not
		// to emit an event as the click was already sent
		cookie.set('gsclick', w.location.href, {
			expires: 5
		});
		sendEvent(e);
	}

	function onChangeHandler (e) {
		e.value = e.target.value;
		sendEvent(e);
	}

	/**
	 * Ghetto script loader to retrieve socket.io. We don't use require.js
	 * so we can just use Almond
	 *
	 * @private
	 * @param  {string} node socket.io client url
	 */
	function loadSocketIO (url) {
		var scripts = d.getElementsByTagName('script'),
			thisScript  = scripts[scripts.length-1],
			script = document.createElement('script'),
			interval;

		script.type = 'text/javascript';
		script.async = true;
		script.src = url;

		thisScript.parentNode.insertBefore(script, thisScript);

		interval = setInterval(function () {
			if (w.io) {
				clearInterval(interval);
				initSocketIO();
			}
		}, 10);
	}


	function initSocketIO () {
		var gsClick = cookie.get('gsclick');

		socket = io.connect();

		socket.on('ready', function () {
			if (isDriver && (gsClick !== w.location.href)) {
				socket.emit('href', w.location.href.replace(/(gsdriver=[^&]*)/ig, ''));
			}

			bindHandlers();
		});

		socket.emit('join', key);

		socket.on('href', function (href) {
			w.location = href;
		});

		socket.on('event', receiveEvent);
	}


	function bindHandlers () {
		d.addEventListener('click', onClickHandler, false);

		var input = d.querySelector('input');
		if (input) {
			input.addEventListener('change', onChangeHandler, false);
			input.addEventListener('focus', sendEvent, false);
			input.addEventListener('blur', sendEvent, false);
		}
	}


	return {
		/**
		 * Initiate the client
		 *
		 * @param  {string} srcURI   URL of client script
		 * @param  {object} win      window ref
		 * @param  {object} doc      document ref
		 */
		init: function (srcURI, win, doc) {
			var ioURIObj;

			w = win;
			d = doc;
			winURIObj = URL.parse(w.location);
			key = winURIObj.queryKey.gskey || URL.parse(srcURI).queryKey.gskey;

			ioURIObj = URL.parse(srcURI);
			ioURIObj.path = SOCKET_IO_PATH;

			if (key) {
				if (winURIObj.queryKey.gsdriver || cookie.get('gsdriver') === key) {
					cookie.set('gsdriver', key, {
						expires: 365 * 24 * 60 * 60
					});
					isDriver = true;
				} else {
					cookie.remove('gsdriver');
				}

				loadSocketIO(URL.make(ioURIObj));
			}
		}
	};
});

/*
	TODO:

	- include weinre
	- bulletproof change events
	- https://github.com/ded/domready
	- fake back/forward buttons
	- include querySelector polyfill + event listener for old IE

 */;