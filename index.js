const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const request = require('request');

const app = express();
const User = require('./model/User');

dotenv.config();
app.use(express.json());
app.use(cors());

mongoose.connect(
  process.env.DB_CONNECT,
  { useUnifiedTopology: true, useNewUrlParser: true },
  () => {
    console.log("DB is connected.")
  }
);

const headers = {
  'Authorization': process.env.AUTH,
  'Simulator': 'EXTERNAL',
  'Content-Type': 'application/json'
};

async function getId(req, callbackfunc) {
  const url = 'https://api.test.paysafe.com/paymenthub/v1/customers';
  //body
  const data = {
    merchantCustomerId: req.email + req.firstName + req.phone + "479877865",
    firstName: req.firstName,
    email: req.email,
    phone: req.phone,
  }
  //options for post request,headersand url
  const requestOptions = {
    url: url,
    headers: headers,
    body: JSON.stringify(data),
    method: 'POST'
  };
  //callback for requests	
  function callback(err, res, body) {
    // console.log(error)
    // console.log(response)
    // console.log(JSON.parse(body).id)
    return callbackfunc(JSON.parse(body).id);
  }

  request(requestOptions, callback);
}

async function getToken(payid, callbackfunc) {
  //url
  const url = 'https://api.test.paysafe.com/paymenthub/v1/customers/';
  //body
  const data = {
    "merchantRefNum": "Ref123",
    "paymentTypes": [
      "CARD"
    ]
  };
  //options for post request,headersand url
  const options = {
    url: url + payid + '/singleusecustomertokens',
    headers: headers,
    body: JSON.stringify(data),
    method: 'POST'
  };
  //callback for requests	
  function callback(err, res, body) {
    // console.log(error)
    console.log("body", body);
    // console.log(JSON.parse(body).singleUseCustomerToken)
    return callbackfunc(JSON.parse(body).singleUseCustomerToken);
  }

  request(options, callback);
}

app.post("/api/token", (req, res) => {
  // const findUser = {
  //   "email": req.body.email
  // };
  // console.log(req.body);
  User.findOne({ email: req.body.email }, async (err, user) => {
    if (err) {
      console.log(err);
    } else {
      // console.log("-----------");
      console.log("User", user);
      if (!user) {
        await getId(req.body,
          function (result) {
            // console.log(result);
            const newUser = {
              payid: result,
              email: req.body.email
            };

            // console.log(newUser)
            User.create(newUser, async (err, newlyCreated) => {
              if (err) {
                console.log(err);
              } else {
                // console.log("///////////////////////////////////");
                user = newlyCreated;
                // console.log("paysafe**********", user);
                await getToken(user.payid, function (result) {
                  res.send({ token: result });
                })
                // console.log("added",newlyCreated)
              }
            });
          });
      } else {
        // console.log("paysafe", user)
        await getToken(user.payid, function (result) {
          // console.log(result);
          res.send({ token: result });
        })
      }
    }
  });

});

app.listen(process.env.PORT || 5000, () => {
  console.log("Server is running.");
});