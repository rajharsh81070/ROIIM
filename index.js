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
    merchantCustomerId: req.email + req.firstName + req.phone,
    firstName: req.firstName,
    email: req.email,
    phone: req.phone,
  };
  //options for post request,headersand url
  const requestOptions = {
    url: url,
    headers: headers,
    body: JSON.stringify(data),
    method: 'POST'
  };
  //callback for requests	
  function callback(err, res, body) {
    // console.log(err)
    // console.log(res)
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

  const options = {
    url: url + payid + '/singleusecustomertokens',
    headers: headers,
    body: JSON.stringify(data),
    method: 'POST'
  };
  function callback(err, res, body) {
    return callbackfunc(JSON.parse(body).singleUseCustomerToken);
  }

  request(options, callback);
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    let r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function payment(req, callbackfunc) {
  const url = 'https://api.test.paysafe.com/paymenthub/v1/payments';

  const data = {
    "merchantRefNum": uuidv4(),
    "amount": req.amount,
    "currencyCode": "USD",
    "paymentHandleToken": req.token,
    "description": "Payment"
  }

  const options = {
    url: url,
    headers: headers,
    body: JSON.stringify(data),
    method: 'POST'
  };
  function callback(error, response, body) {
    console.log(body);
    return callbackfunc(body);
  }
  request(options, callback);
}

app.post("/api/token", (req, res) => {
  User.findOne({ email: req.body.email }, async (err, user) => {
    if (err) {
      console.log(err);
    } else {
      console.log("User", user);
      if (!user) {
        await getId(req.body,
          function (result) {
            const newUser = {
              payid: result,
              email: req.body.email
            };
            User.create(newUser, async (err, newlyCreated) => {
              if (err) {
                console.log(err);
              } else {
                user = newlyCreated;
                await getToken(user.payid, function (result) {
                  res.send({ token: result });
                })
              }
            });
          });
      } else {
        await getToken(user.payid, function (result) {
          res.send({ token: result });
        })
      }
    }
  });
});

app.post("/api/payment", async (req, res) => {
  await payment(req.body, function (result) {
    res.send({ data: result.status });
  });
});

app.listen(process.env.PORT || 5000, () => {
  console.log("Server is running.");
});