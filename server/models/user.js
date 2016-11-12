'use strict';

/**
 * Module dependencies.
 */
var mongoose  = require('mongoose'),
    Schema    = mongoose.Schema,
    crypto    = require('crypto'),
    _   = require('lodash');

/**
 * Account Schema
 */
var AccountSchema = new Schema({
  type: String, //etsy, shopify, bigcommerce, storenvy
  details: {}
});


var validateUniqueEmail = function(value, callback) {
  var User = mongoose.model('User');
  User.find({
    $and: [{
      email: value
    }, {
      _id: {
        $ne: this._id
      }
    }]
  }, function(err, user) {
    callback(err || user.length === 0);
  });
};


/**
 * Subscription Schema
 */
var WaitingUserSchema = new Schema({
  platform: String,
  email: {
    type: String,
    required: true,
    unique: true,
    // Regexp to validate emails with more strict rules as added in tests/users.js which also conforms mostly with RFC2822 guide lines
    match: [/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/, 'Please enter a valid email'],
    validate: [validateUniqueEmail, 'E-mail address is already in-use']
  },
  created_at: Date
});
mongoose.model('WaitingUser', WaitingUserSchema);

/**
 * Pre-save hook
 */
WaitingUserSchema.pre('save', function(next) {
  var now = new Date();
  if ( !this.created_at ) {
    this.created_at = now;
  }
  next();
});

/**
 * Subscription Schema
 */
var SubscriptionSchema = new Schema({
  title: String,
  type: String,
  duration: Number,
  is_trial: Boolean,
  start_date : Date,
  active: Boolean,
  paypal_id: String,
  stripe_id: String,
  braintree_id: String,
  frequency: String
});
mongoose.model('Subscription', SubscriptionSchema);


SubscriptionSchema.virtual('end_date').get(function() {
  var endDate = new Date();
  endDate.setDate(this.start_date.getDate() + this.duration);

  return endDate;
});

/**
 * Validations
 */
var validatePresenceOf = function(value) {
  // If you are authenticating by any of the oauth strategies, don't validate.
  return (this.provider && this.provider !== 'local') || (value && value.length);
};

/**
 * Getter
 */
var escapeProperty = function(value) {
  return _.escape(value);
};


/**
 * UnregisteredUser Schema
 */

var UnregisteredUserSchema = new Schema({
  email: String,
  paypal_email: String,
  type: String,
  reason: String,
  subscriptions: [SubscriptionSchema],
  created_at: Date,
  closed_at: Date
});

/**
 * Pre-save hook
 */
UnregisteredUserSchema.pre('save', function(next) {
  var now = new Date();
  if ( !this.closed_at ) {
    this.closed_at = now;
  }
  next();
});

UnregisteredUserSchema.virtual('subscription').get(function() {
  return _.max(this.subscriptions, function(subscription) { return subscription.start_date; });
});

/**
 * User Schema
 */

var UserSchema = new Schema({
  name: {
    type: String,
    get: escapeProperty
  },
  email: {
    type: String,
    required: true,
    unique: true,
    // Regexp to validate emails with more strict rules as added in tests/users.js which also conforms mostly with RFC2822 guide lines
    match: [/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/, 'Please enter a valid email'],
    validate: [validateUniqueEmail, 'E-mail address is already in-use']
  },
  test: { //indicates if it is a test user
    type: Boolean,
    default: false
  },
  username: {
    type: String,
    unique: true,
    get: escapeProperty
  },
  roles: {
    type: Array,
    default: ['authenticated']
  },
  hashed_password: {
    type: String,
    validate: [validatePresenceOf, 'Password cannot be blank']
  },
  provider: {
    type: String,
    default: 'local'
  },
  catalogProperties: [{type: Schema.Types.ObjectId, ref: 'CatalogProperties'}],
  subscriptions: [SubscriptionSchema],
  settings: {
    type: {
      page_format: {
        type: String
      },
      default_layout: {
        type: Schema.ObjectId,
        ref: 'PageLayout'
      },
      language: {
        type: String,
        default: 'en'
      }
    },
    default: {
      page_format: 'Letter',
      language: 'en'
    } // 'A4' or 'Letter'
  },
  profile: {
    type: String,
    default: 'standard'
  }, //supermarket, standard
  shopify_theme_id: String,
  stripe_id: String,
  paypal_id: String,
  salt: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  facebook: {},
  twitter: {},
  github: {},
  google: {},
  linkedin: {},
  shopify: {},
  accounts: [AccountSchema],
  catalogs: [{type: Schema.Types.ObjectId, ref: 'Catalog'}],
  created_at: {
    type: Date
  }
});



var PotentialCustomerSchema = new Schema({
  name: {
    type: String,
    get: escapeProperty
  },
  business_name: {
    type: String,
    get: escapeProperty
  },
  slug: {
    type: String
  },
  email: {
    type: String,
    required: true,
    unique: true,
    // Regexp to validate emails with more strict rules as added in tests/users.js which also conforms mostly with RFC2822 guide lines
    match: [/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/, 'Please enter a valid email'],
    validate: [validateUniqueEmail, 'E-mail address is already in-use']
  },
  phone: String,
  address_line_1: String,
  address_line_2: String,
  postal_code: String,
  city: String
});

/**
 * Virtuals
 */
UserSchema.virtual('password').set(function(password) {
  this._password = password;
  this.salt = this.makeSalt();
  this.hashed_password = this.hashPassword(password);
}).get(function() {
  return this._password;
});

UserSchema.virtual('subscription').get(function() {
  return _.max(this.subscriptions, function(subscription) { return subscription.start_date; });
});


UserSchema.virtual('has_expired').get(function() {
  var hasExpired = false;
  var subscription = this.subscription;
  if (subscription && subscription.start_date &&  subscription.duration) {
    var endDate = new Date();
    endDate.setDate(subscription.start_date.getDate() + subscription.duration);
    hasExpired = endDate < new Date();
  }

  return hasExpired;
});

UserSchema.virtual('is_active').get(function() {
  return _.where(this.subscriptions, {active: true}).length > 0;
});

UserSchema.virtual('business_name').get(function() {
  var businessName = '';
  for (var i = 0; i < this.accounts.length; i += 1) {
    var account = this.accounts[i];
    if (account.type === 'etsy') {
      var shops = account.details.profile.Shops;
      if (shops.length > 0) {
        businessName = shops[0].shop_name;
      }
    } else if (account.type === 'shopify') {
      businessName = account.details.profile.name;
    } else if (account.type === 'bigcommerce') {
      businessName = account.details.profile.name;
    } else if (account.type === 'tictail') {
      businessName = account.details.profile.name;
    } else if (account.type === 'ecwid') {
      businessName = account.details.profile.company.companyName;
    } else if (account.type === 'nowinstore') {
      businessName = account.details.profile.name;
    } else if (account.type === 'magento') {
      businessName = account.details.profile.business_name;
    }
  }
  return businessName;
});

function toTitleCase(str) {
  if (!str) {
    return '';
  }
  return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}


function toUpperCase(str) {
  if (!str) {
    return '';
  }
  return str.toUpperCase();
}


UserSchema.virtual('address').get(function() {
  var address = '';
  for (var i = 0; i < this.accounts.length; i += 1) {
    var account = this.accounts[i];
    if (account.type === 'etsy') {
      var addresses = account.details.profile.Addresses;
      if (addresses.length > 0) {
        var etsyAddress = addresses[0];
        address =  '<p>' + toTitleCase(etsyAddress.first_line);
        if (etsyAddress.second_line) {
          address +=  toTitleCase(etsyAddress.second_line);
        }
        address += '<br/>' + toTitleCase(etsyAddress.city) + '<br/>' + toTitleCase(etsyAddress.state) +
            ' ' + etsyAddress.zip.toUpperCase() + '<br/>'+ toTitleCase(etsyAddress.country_name) +'</p>';
      }
    } else if (account.type === 'shopify') {
      var profile = account.details.profile;
      address = '<p>'+profile.address1+'<br/>'+profile.city+', '+profile.province_code+' '+profile.zip+'<br/>'+profile.country+'</p>';
    } else if (account.type === 'bigcommerce') {
      address = account.details.profile.address.replace(/\n/g, '<br/>');
    } else if (account.type === 'ecwid') {
      var ecwidAddress = account.details.profile.company;
      address += '<br/>' + toTitleCase() + '<br/>' + toTitleCase(ecwidAddress.stateOrProvinceCode) +
          ' ' + toUpperCase(ecwidAddress.postalCode) + '<br/>'+ toTitleCase(ecwidAddress.countryCode) +'</p>';
    } else if (account.type === 'magento') {
      address = account.details.profile.address;
    }
  }
  return address;
});

/**
 * Pre-save hook
 */
UserSchema.pre('save', function(next) {
  var now = new Date();
  if ( !this.created_at ) {
    this.created_at = now;
  }

  if (this.isNew && this.provider === 'local' && this.password && !this.password.length)
    return next(new Error('Invalid password'));
  next();
});

/**
 * Methods
 */
UserSchema.methods = {

  /**
   * HasRole - check if the user has required role
   *
   * @param {String} plainText
   * @return {Boolean}
   * @api public
   */
  hasRole: function(role) {
    var roles = this.roles;
    return roles.indexOf('admin') !== -1 || roles.indexOf(role) !== -1;
  },

  /**
   * IsAdmin - check if the user is an administrator
   *
   * @return {Boolean}
   * @api public
   */
  isAdmin: function() {
    return this.roles.indexOf('admin') !== -1;
  },

  /**
   * Authenticate - check if the passwords are the same
   *
   * @param {String} plainText
   * @return {Boolean}
   * @api public
   */
  authenticate: function(plainText) {
    return this.hashPassword(plainText) === this.hashed_password;
  },

  /**
   * Make salt
   *
   * @return {String}
   * @api public
   */
  makeSalt: function() {
    return crypto.randomBytes(16).toString('base64');
  },

  /**
   * Hash password
   *
   * @param {String} password
   * @return {String}
   * @api public
   */
  hashPassword: function(password) {
    if (!password || !this.salt) return '';
    var salt = new Buffer(this.salt, 'base64');
    return crypto.pbkdf2Sync(password, salt, 10000, 64).toString('base64');
  },

  /**
   * Hide security sensitive fields
   *
   * @returns {*|Array|Binary|Object}
   */
  toJSON: function() {
    var obj = this.toObject();
    delete obj.hashed_password;
    delete obj.salt;
    return obj;
  }
};

mongoose.model('User', UserSchema);
mongoose.model('UnregisteredUser', UnregisteredUserSchema);
mongoose.model('Subscription', SubscriptionSchema);
mongoose.model('Account', AccountSchema);
mongoose.model('PotentialCustomer', PotentialCustomerSchema);
