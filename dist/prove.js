!function ($) {
	"use strict";

	$.fn.validate = function(options) {

		var el = $(this);
		var prove = el.data('prove');

		if (options && prove) {

			// alias prove plugin
			el.prove(options);
		} else if (prove) {

			// alias prove form validate
			return el.data('prove').validate();
		} else {

			//alias input trigger validation
			el.each(function(){
				var input = $(this);
				var prove = el.data('prove');
				var event = (prove)? 'validate.form.prove' : 'validate.field.prove';
				input.trigger(event);
			});
		}
		return this;
	};
}(window.jQuery);

/**
 * jQuery Prove (https://github.com/dhollenbeck/jquery-prove)
 */
!function ($) {
	"use strict";

	// Prove constructor
	function Prove(form, options) {

		this.$form = $(form);

		// multiple instances requires extending from {}
		this.options = $.extend({}, this.defaults, options);

		if (options.debug){
			console.groupCollapsed('Prove()');
			console.log('options', options);
			console.groupEnd();
		}

		this.checkOptions();
		this.setupFields();
		this.setupForm();
		this.setupSubmitIntercept();

		this.$form.trigger('setup.form.prove');
	}

	//$.Prove.prototype.defaults = {
	Prove.prototype = {

		defaults: {
			//control how prove should handle submit button clicks
			submit: {
				button: 'button:submit', //submit button selector
				validate: 'button:submit:not(.skip-validation)',//booleanator, validate on submit, but not if element has class `skip-validation`
				// validate: '#skip-validation:checked',
				prevent: false, //booleanator
				twice: false //todo: allow some forms to submit twice
			}
		},
		constructor: Prove,
		destroy: function() {
			this.teardownFields();
			this.teardownForm();
			this.$form.data('prove', false);
			this.$form.trigger('destroyed.form.prove');
		},
		checkOptions: function(){

			//return early
			//if (!this.options.debug) return;

			//check prove options here
			if (!this.options.fields) console.warn('Missing fields option.');

			$.each(this.options.fields, function(index, field){

				if (!field.validators) console.warn('Missing validators option for field "%s".', index);
			});
		},
		setupSubmitIntercept: function(){
			var selector = this.options.submit.button;
			var handler = $.proxy(this.submitInterceptHandler, this);
			// we intercept the submit by bind `click` rather than ':submit'
			this.$form.on('click', selector, handler);
		},
		submitInterceptHandler: function(event){

			var shouldValidate = this.$form.booleanator(this.options.submit.validate);
			var preventSubmit = this.$form.booleanator(this.options.submit.prevent);
			var isValid = (shouldValidate)? this.validate() : undefined;
			var nosubmit = !!this.$form.attr('nosubmit');

			var submitSetup = (isValid && !nosubmit);
			var submitStop = (isValid === false || preventSubmit || nosubmit);

			/*
				Of note, the following things did not work to stop double submits.
				If you add the 'disabled' attribute to the button then the next
				submit handler will not be invoked and the form will not be sumitted
				either via ajax or traditional.

				todo: will adding the disabled attr stop double submits on on IE?
				http://stackoverflow.com/a/17107357/2620505

				If you add the bootstrap `disabled` class the button still invokes
				the this intercept handler.
			*/

			console.groupCollapsed('submitInterceptHandler()');
			console.log('shouldValidate', shouldValidate);
			console.log('preventSubmit', preventSubmit);
			console.log('nosubmit', nosubmit);
			console.log('isValid', isValid);
			console.groupEnd();

			if (submitSetup) {

				// Add attribute to disable double form submissions.
				this.$form.attr('nosubmit', true);

				// trigger event - for decorator
				this.$form.trigger('submitted.form.prove', {
					validated: shouldValidate
				});
			}

			// stop form submit
			if (submitStop) event.preventDefault();
		},
		//return jquery selector that represents the element in the DOM
		domSelector: function(field){
			return (field.selector)
				? field.selector
				: '[name="' + field.name + '"]';
		},
		//return string of space seperated events used to detect change to the DOM element
		fieldDomEvents: function(field){
			var events = field.trigger || 'change keyup click blur';
			return events;
		},

		isPlugin: function(plugin){
			var exist = (typeof $.fn[plugin] === 'function');
			if (!exist) console.error('Missing validator plugin "%s".', plugin);
			return exist;
		},
		setupForm: function(){
			this.html5NoValidate(true);
			this.bindDomFormEvents();
		},
		teardownForm: function(){
			this.html5NoValidate(false);
			this.unbindDomFormEvents();
		},
		setupFields: function(options){

			var opts = options || this.options;
			var fields = opts.fields || {};
			var that = this;

			//console.log('setupFields()');

			$.each(fields, function(name, field){

				//copy field name inside field config
				field.name = name;

				that.bindDomFieldEvents(field);
				that.bindFieldProveEvent(field);

				var selector = that.domSelector(field);
				that.$form.find(selector).trigger('setup.field.prove');
			});
		},
		teardownFields: function(options){

			var opts = options || this.options;
			var fields = opts.fields || {};
			var that = this;

			//console.log('teardownFields()');

			$.each(fields, function(name, field){
				that.unbindDomFieldEvents(field);
				that.unbindFieldProveEvent(field);

				var selector = that.domSelector(field);
				that.$form.find(selector).trigger('destroyed.field.prove');
			});
		},
		html5NoValidate: function(state){
			this.$form.attr("novalidate", state);
		},
		/**
		* DOM Input Events Listener
		*/
		bindDomFieldEvents: function(field){

			var el = this.$form;
			var domEvents = this.fieldDomEvents(field);
			var selector = this.domSelector(field);
			var handler = $.proxy(this.domFieldEventsHandler, this);
			var data = clone(field);

			// honor request to disable live validation
			if (field.trigger === false) return;

			// http://api.jquery.com/on/
			el.on(domEvents, selector, data, handler);
		},
		unbindDomFieldEvents: function(field){

			var el = this.$form;
			var domEvents = this.fieldDomEvents(field);
			var selector = this.domSelector(field);

			// http://api.jquery.com/off/
			el.off(domEvents, selector);
		},
		domFieldEventsHandler: function(event){

			var input = $(event.target);
			var field = event.data;

			this.checkField(field, input);
		},
		/**
		* DOM Form Events Listener
		*/
		bindDomFormEvents: function(){
			var handler = $.proxy(this.proveEventHandler1, this);
			this.$form.on('validate.form.prove', handler);
		},
		unbindDomFormEvents: function(){
			this.$form.off('validate.form.prove');
		},
		proveEventHandler1: function(event){
			event.preventDefault();
			this.validate();
		},
		/**
			Bind Event 'validate.field.prove'
			https://github.com/dhollenbeck/jquery-prove#event-validatefieldprove

			The concern with this code is that for every prove field we bind a new
			event handler on the form container. The reason we do this because we
			also bind the field config (as event data) to the event so the event handler
			knows the field. Could the event handler determine the field config another way?

			Option 1: Can we determine from event target which field config to use?
			1. try the input.attr('name') to match field name.
			2. does any of the field config selectors match this input?
				var name = input.attr('name');
				$.each(fields, function(field, config){
					if (name === field || input.is(config.selector)) // found correct field
				})
			option 2: require the code that triggers the validate event to pass in
			the field name: input.trigger('validate', {field: 'fieldName'})

		*/
		bindFieldProveEvent: function(field){

			var selector = this.domSelector(field);
			var handler = $.proxy(this.proveEventHandler2, this);
			var data = clone(field);

			this.$form.on('validate.field.prove', selector, data, handler);
		},
		unbindFieldProveEvent: function(field){

			//go from field config to selector
			var selector = this.domSelector(field);
			this.$form.off('validate.field.prove', selector);
		},
		proveEventHandler2: function(event){

			event.preventDefault();
			var input = $(event.target);
			var field = event.data;

			this.checkField(field, input);
		},

		//todo: make this a plugin
		checkField: function(field, input){ //todo: rename proveInput

			var data, isValid;
			var that = this;
			var fieldName = field.name;
			var validators = field.validators || {};
			var isEnabled = input.booleanator(field.enabled);

			//return early if nothing to do
			if (!isEnabled) {
				//trigger event indicating validation state
				input.trigger('validated.field.prove', data);
				return isValid;
			}

			// loop each validator
			$.each(validators, function(validatorName, config){

				config.field = fieldName;

				//invoke validator plugin
				if (!that.isPlugin(validatorName)) return false;
				var result = input[validatorName](config);

				// Compose data the decorator will be interested in
				data = {
					field: result.field,
					state: result.state,
					message: config.message,
					validator: {
						name: result.validator,
						config: clone(config)
					}
				};

				isValid = result.state;

				//return of false to break loop
				return isValid;
			});

			//trigger event indicating validation state
			input.trigger('validated.field.prove', data);

			return isValid;
		},

		//validate entire form
		// todo: this could be plugin where the plugin gets prove instance via $(this).data('prove')
		validate: function(){
			//console.log('Prove.validate()');

			var fields = this.options.fields;
			var checkField = $.proxy(this.checkField, this);
			var isValid = true;
			var that = this;

			$.each(fields, function(index, field){

				var selector = that.domSelector(field);
				var input = that.$form.find(selector);
				var isMultiple = input.is(':multiple');
				var isValidField;

				if (isMultiple){
					//handle case when name="field[]"
					input.each(function(){
						var input = $(this);
						isValidField = checkField(field, input);
						if (isValidField === false) isValid = false;
						if (isValidField === true && isValid !== false) isValid = true;
					});
				}  else {
					//handle case where name="field"
					isValidField = checkField(field, input);
					if (isValidField === false) isValid = false;
					if (isValidField === true && isValid !== false) isValid = true;
				}
			});

			//trigger event indicating validation state
			// todo: return validators (state and messages)
			this.$form.trigger('validated.form.prove', {
				state: isValid
			});

			return isValid;
		}
	};

	$.fn.prove = function(option, parameter, extraOptions) {

		return this.each(function() {

			var form = $(this);
			var prove = form.data('prove');
			var options = typeof option === 'object' && option;
			var isInitialized = !!prove;

			// either initialize or call public method
			if (!isInitialized) {
				// initialize new instance
				prove = new Prove(this, options);
				form.data('prove', prove);
				form.trigger('initialized.prove');
			} else if (typeof option === 'string') {
				// call public method
				// todo: warn if public method does not exist
				prove[option](parameter, extraOptions);
			} else {
				throw new Error('invalid invocation.');
			}
		});
	};

	$.fn.prove.Constructor = Prove;

	function clone(obj){
		return $.extend({}, obj);
	}

}(window.jQuery);

!function ($) {
	"use strict";

	// Custom selectors
	$.extend( $.expr[":"], {

		// http://jqueryvalidation.org/blank-selector/
		blank: function( a ) {
			return !$.trim( "" + $( a ).val() );
		},

		// http://jqueryvalidation.org/filled-selector/
		filled: function( a ) {
			var val = $( a ).val();
			return val !== null && !!$.trim( "" + val );
		},

		// http://jqueryvalidation.org/unchecked-selector/
		unchecked: function( a ) {
			return !$( a ).prop( "checked" );
		},

		//http://www.sitepoint.com/make-your-own-custom-jquery-selector/
		inview: function(el) {
			if ($(el).offset().top > $(window).scrollTop() - $(el).outerHeight(true) && $(el).offset().top < $(window).scrollTop() + $(el).outerHeight(true) + $(window).height()) {
				return true;
			}
			return false;
		},

		multiple: function(el) {
			var name = $(el).attr('name') || '';
			return (name.charAt(name.length - 1) === ']');
		}

	});
}(window.jQuery);

!function ($) {
	"use strict";

	//todo: support a `this` context and also a passed in context
	$.fn.booleanator = function(param) {

		var state;

		function evalSelector(selector){
			try {
				return !!$(selector).length;
			} catch (e) {
				console.warn('Invalid jquery selector (`%s`) param for booleanator plugin.', selector);
				return false;
			}
		}

		function evalIs(selector, context){
			try {
				return $(context).is(selector);
			} catch (e) {
				console.warn('Invalid jquery pseudo selector (`%s`) param for booleanator plugin.', selector);
				return false;
			}
		}

		if (typeof param === 'undefined'){
			state = true;
		} else if (typeof param === 'boolean') {
			state = param;
		} else if (typeof param === 'string'){
			state = (param.charAt(0) === ':')
				? evalIs(param, this)
				: evalSelector(param);
		} else if (typeof param === 'function'){
			state = param();
		} else {
			throw new Error('Invalid param for booleanator plugin.');
		}

		return state;
	};
}(window.jQuery);

!function ($) {
	"use strict";

	$.fn.hasValue = function(){

		var input = $(this);
		var value = input.vals();
		var isString, isArray, hasValue;

		isString = (typeof value === 'string');
		isArray = $.isArray(value);
		value = (isString)? $.trim(value) : value;
		hasValue = ((isString && !!value.length) || (isArray && !!value.length && !!value[0].length));
		return hasValue;
	};
}(window.jQuery);

!function ($) {
	"use strict";

	$.fn.huntout = function(selector){
		var el = $(this);
		var container;

		if (typeof selector === 'string') {
			container = el.closest(selector);
		} else if ($.isArray(selector)){

			// test each array item until we find one
			// loop selectors in array of selectors until
			// we find the closests.
			for (var i = 0; i < selector.length; i++) {
				container = el.closest(selector[i]);
				if (container.length > 0) break;
			}
		} else if (typeof selector === 'function') {
			container = el.parents().filter(selector());
		} else {
			throw new Error('Invalid selector ("%s") param in huntout plugin.', selector);
		}

		return container;
	};

}(window.jQuery);

!function ($) {
	"use strict";

	$.fn.vals = function(options) {

		options = options || {};

		var input = $(this);
		var type = input.attr('type');
		var isSelect = input.is('select');
		var isCheckbox = (type === 'checkbox');
		var isRadio = (type === 'radio');
		var isNumber = (type === 'number');
		var isFile = (type === 'file');
		var name = input.attr('name');
		var val, idx, selector;


		if (isSelect){
			val = input.val();
		} else if ( isRadio ) {
			// single selection model
			val = input.filter(':checked').val();
		} else if ( isCheckbox){
			// multiple selection model
			selector = '[name="' + name + '"]:checked';
			val = input.closest('form').find(selector).val();
		} else if ( isNumber && typeof input.validity !== 'undefined' ) {
			val = input.validity.badInput ? NaN : input.val();
		} else if ( isFile ) {

			val = input.val();

			// Modern browser (chrome & safari)
			if ( val.substr( 0, 12 ) === 'C:\\fakepath\\' ) val = val.substr( 12 );

			// Legacy browsers, unix-based path
			idx = val.lastIndexOf( '/' );
			if ( idx >= 0 ) val = val.substr( idx + 1 );

			// Windows-based path
			idx = val.lastIndexOf( '\\' );
			if ( idx >= 0 ) val = val.substr( idx + 1 );
		} else if ( input.attr('contenteditable') ) {
			val = input.text();
		} else {
			val = input.val();
		}

		if ( typeof val === 'string' ) return val.replace( /\r/g, '' );

		return val;
	};
}(window.jQuery);

!function ($) {
	"use strict";

	$.fn.proveEqualTo = function( options ) {

		var input = $(this);
		var other = $(options.equalTo);
		var form = input.closest('form');
		var isSetup = input.hasClass('validator-equalto-setup');
		var isEnabled = $('body').booleanator(options.enabled);
		var isValid = (isEnabled)? (input.val() === other.val()) : undefined;

		//setup event to validate this input when other input value changes
		if (!isSetup){
			input.addClass('validator-equalto-setup');
			//on blur of other input
			form.on('focusout', options.equalTo, function(){
				input.validate();
			});
		}

		//return current validation state
		return {
			validator: 'proveEqualTo',
			field: options.field,
			state: isValid
		};
	};
}(window.jQuery);

!function ($) {
	"use strict";

	/**
	* Required validator.
	* @param {object} options The validator configuration.
	* @option {string or array} state The input value to validate.
	* @option {object} values All input values.
	* @return {bool or null} The result of the validation.
	*/
	$.fn.proveLength = function(options){

		var input = $(this);
		var value = input.vals();
		var hasValue = input.hasValue();
		var isValid = input.hasValue();
		var isEnabled = $('body').booleanator(options.enabled);
		var okMin = (typeof options.min !== 'undefined')? (value.length >= options.min) : true;
		var okMax = (typeof options.max !== 'undefined')? (value.length <= options.max) : true;

		if (!isEnabled){
			isEnabled = undefined;
		} else if (!hasValue) {
			// All validators are optional except of `required` validator.
			isValid = true;
		} else if (okMin && okMax) {
			isValid = true;
		} else {
			isValid = false;
		}

		if (options.debug){
			console.groupCollapsed('Validator.proveLength()', options.field);
				console.log('options', options);
				console.log('input', input);
				console.log('value', value);
				console.log('isEnabled', isEnabled);
				console.log('isValid', isValid);
			console.groupEnd();
		}

		return {
			validator: 'proveLength',
			field: options.field,
			state: isValid
		};
	};
}(window.jQuery);

!function ($) {
	"use strict";

	$.fn.proveMin = function(options){

		var input = (options.context)? options.context(this) : $(this);
		var value = input.vals();
		var isEnabled = $('body').booleanator(options.enabled);
		var isValid = (isEnabled)? value <= options.max : undefined;

		if (options.debug){
			console.groupCollapsed('Validator.proveMin()', options.field);
				console.log('options', options);
				console.log('input', input);
				console.log('value', value);
				console.log('isEnabled', isEnabled);
				console.log('isValid', isValid);
			console.groupEnd();
		}

		return {
			validator: 'proveMax',
			field: options.field,
			state: isValid
		};
	};
}(window.jQuery);

!function ($) {
	"use strict";

	$.fn.proveMin = function(options){

		var input = (options.context)? options.context(this) : $(this);
		var value = input.vals();
		var isEnabled = $('body').booleanator(options.enabled);
		var isValid = (isEnabled)? value >= options.min : undefined;

		if (options.debug){
			console.groupCollapsed('Validator.proveMin()', options.field);
				console.log('options', options);
				console.log('input', input);
				console.log('value', value);
				console.log('isEnabled', isEnabled);
				console.log('isValid', isValid);
			console.groupEnd();
		}

		return {
			validator: 'proveMin',
			field: options.field,
			state: isValid
		};
	};
}(window.jQuery);

!function ($) {
	"use strict";

	$.fn.provePattern = function(options){

		var input = $(this);
		var value = input.val();
		var hasValue = input.hasValue();
		var isEnabled = $('body').booleanator(options.enabled);
		var regex = (options.regex instanceof RegExp)
			? options.regex
			: new RegExp( "^(?:" + options.regex + ")$" );
		var isValid;

		if (!isEnabled){
			// Validators should return undefined when there is no value.
			// Decoraters will teardown any decoration when they receive an `undefined` validation state.
			isValid = undefined;
		} else if (!hasValue) {
			// All validators (except proveRequired) should return undefined when there is no value.
			// Decoraters will teardown any decoration when they receive an `undefined` validation state.
			isValid = undefined;
		} else if (regex instanceof RegExp) {
			isValid = regex.test(value);
		} else {
			isValid = false;
		}

		if (options.debug){
			console.groupCollapsed('Validator.provePattern()', options.field);
				console.log('options', options);
				console.log('isValid', isValid);
			console.groupEnd();
		}

		return {
			validator: 'provePattern',
			field: options.field,
			state: isValid
		};
	};

}(window.jQuery);

!function ($) {
	"use strict";

	$.fn.provePrecision = function(options){

		var regex = /^(.)*(\.[0-9]{1,2})?$/;
		var input = (options.context)? options.context(this) : $(this);
		var value = input.vals();
		var isEnabled = $('body').booleanator(options.enabled);
		var isValid = (isEnabled)? regex.test(value) : undefined;

		if (options.debug){
			console.groupCollapsed('Validator.provePrecision()', options.field);
				console.log('options', options);
				console.log('input', input);
				console.log('value', value);
				console.log('isEnabled', isEnabled);
				console.log('isValid', isValid);
			console.groupEnd();
		}

		return {
			validator: 'provePrecision',
			field: options.field,
			state: isValid
		};
	};
}(window.jQuery);

!function ($) {
	"use strict";

	$.fn.proveRequired = function(options){

		var input = (options.context)? options.context(this) : $(this);
		var value = input.vals();
		var isEnabled = $('body').booleanator(options.enabled);
		var isValid = (isEnabled)? input.hasValue() : undefined;

		if (options.debug){
			console.groupCollapsed('Validator.proveRequired()', options.field);
				console.log('options', options);
				console.log('input', input);
				console.log('value', value);
				console.log('isEnabled', isEnabled);
				console.log('isValid', isValid);
			console.groupEnd();
		}

		return {
			validator: 'proveRequired',
			field: options.field,
			state: isValid
		};
	};
}(window.jQuery);
