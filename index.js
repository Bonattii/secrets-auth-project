require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const encrypt = require('mongoose-encryption');

const app = express();
const PORT = process.env.PORT || 3000;

// Allow static files at public folder, req.body and view engine ejs
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

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

// Create a secret and use the encrypt plugin in the userSchema
userSchema.plugin(encrypt, {
  secret: process.env.SECRET,
  encryptedFields: ['password']
});

// Mongoose will automatically convert User into users
const User = new mongoose.model('User', userSchema);

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
    // Create a new user
    const newUser = new User({
      email: req.body.username,
      password: req.body.password
    });

    // Save the new user on the users collection
    newUser.save(err => (err ? console.log(err) : res.render('secrets')));
  });

// localhost:3000/login
app
  .route('/login')
  .get((req, res) => {
    res.render('login');
  })
  .post((req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    // Search for a user with the credentials
    User.findOne({ email: username }, (err, foundUser) => {
      if (err) {
        console.log(err);
      } else {
        // If the user exists on the collections check if the passwords match
        if (foundUser) {
          if (foundUser.password === password) {
            res.render('secrets');
          }
        }
      }
    });
  });

app.listen(PORT, () => console.log(`Server running at port ${PORT}`));
