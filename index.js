require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();
const PORT = process.env.PORT || 3000;

// Allow static files at public folder, req.body and view engine ejs
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

// Configure the app to use the express-session
app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
  })
);

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Connect with the userDB
mongoose.connect(process.env.MONGO_URI);

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String
});

// Set the passport local mongoose to be a plugin of hashing on the schema
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// Mongoose will automatically convert User into users
const User = new mongoose.model('User', userSchema);

// Congigure the serialize and deserialize
passport.use(User.createStrategy());

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => done(err, user));
});

// Config passport to user google authentication
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: 'http://localhost:3000/auth/google/secrets',
      userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo'
    },
    (accessToken, refreshToken, profile, cb) => {
      // Find a user on the DB or create if didn't found
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

// localhost:3000/
app.get('/', (req, res) => {
  res.render('home');
});

// localhost:3000/auth/google
app.get(
  '/auth/google',
  // Authenticate the user using google
  passport.authenticate('google', { scope: ['profile'] })
);

// localhost:3000/auth/google/secrets
app.get(
  '/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: '/login' }),
  // Successful authentication, redirect to secrets page
  (req, res) => res.redirect('/secrets')
);

// localhost:3000/register
app
  .route('/register')
  .get((req, res) => {
    res.render('register');
  })
  .post((req, res) => {
    // Register a new user on the collection
    User.register(
      { username: req.body.username },
      req.body.password,
      (err, user) => {
        if (err) {
          console.log(err);
          res.redirect('/register');
        } else {
          // If any errors will authenticate the user and send to the secrets page
          passport.authenticate('local')(req, res, () => {
            res.redirect('/secrets');
          });
        }
      }
    );
  });

// localhost:3000/login
app
  .route('/login')
  .get((req, res) => {
    res.render('login');
  })
  .post((req, res) => {
    const user = new User({
      username: req.body.username,
      password: req.body.password
    });

    req.login(user, err => {
      if (err) console.log(err);

      // Authenticate the login and if was success redirect to secrets
      passport.authenticate('local')(req, res, () => {
        res.redirect('/secrets');
      });
    });
  });

// localhost:3000/secrets
app.get('/secrets', (req, res) => {
  // Find users where secret is not null
  User.find({ secret: { $ne: null } }, (err, foundUsers) => {
    if (err) {
      console.log(err);
    } else {
      if (foundUsers) {
        res.render('secrets', { usersWithSecrets: foundUsers });
      }
    }
  });
});

// localhost:3000/submit
app
  .route('/submit')
  .get((req, res) => {
    // If the user is logged will render the submit page
    req.isAuthenticated() ? res.render('submit') : res.redirect('/login');
  })
  .post((req, res) => {
    const submittedSecret = req.body.secret;

    // If find a user will save the secret to the collection
    User.findById(req.user.id, (err, foundUser) => {
      if (err) {
        console.log(err);
      } else {
        if (foundUser) {
          foundUser.secret = submittedSecret;
          foundUser.save(() => res.redirect('/secrets'));
        }
      }
    });
  });

// localhost:3000/logout
app.get('/logout', (req, res) => {
  req.logout(err => {
    err ? console.log(err) : res.redirect('/');
  });
});

app.listen(PORT, () => console.log(`Server running at port ${PORT}`));
