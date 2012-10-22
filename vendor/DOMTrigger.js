/*! DOMTrigger.js - v0.1.0 - 2012-10-22
* https://github.com/stevoland/DOMTrigger.js
 Licensed MIT */

(function (root, factory, d) {
	if (typeof exports === 'object') {
		module.exports = factory();
	} else if (typeof define === 'function' && define.amd) {
		define([], factory);
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