require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');

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
  email: {
    type: String,
    require: [true, 'Users need to have an email.']
  },
  password: {
    type: String,
    require: [true, 'Users need to have a password.']
  }
});

// Set the passport local mongoose to be a plugin of hashing on the schema
userSchema.plugin(passportLocalMongoose);

// Mongoose will automatically convert User into users
const User = new mongoose.model('User', userSchema);

// Congigure the serialize and deserialize
passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// localhost:3000/
app.route('/').get((req, res) => {
  res.render('home');
});

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
app.route('/secrets').get((req, res) => {
  // If the user is logged will render the secrets page
  req.isAuthenticated() ? res.render('secrets') : res.redirect('/login');
});

// localhost:3000/logout
app.get('/logout', (req, res) => {
  req.logout(err => {
    if (err) console.log(err);
    res.redirect('/');
  });
});

app.listen(PORT, () => console.log(`Server running at port ${PORT}`));
