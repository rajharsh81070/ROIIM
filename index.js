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

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    let r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function createPayid(req, callbackfunc) {
  const url = 'https://api.test.paysafe.com/paymenthub/v1/customers';
  const data = {
    merchantCustomerId: req.email + req.firstName + req.phone,
    firstName: req.firstName,
    email: req.email,
    phone: req.phone,
  };
  const requestOptions = {
    url: url,
    headers: headers,
    body: JSON.stringify(data),
    method: 'POST'
  };

  request(requestOptions, (err, res, body) => {
    return callbackfunc(JSON.parse(body).id);
  });
}

async function createToken(payid, callbackfunc) {
  const url = 'https://api.test.paysafe.com/paymenthub/v1/customers/';

  const data = {
    "merchantRefNum": uuidv4(),
    "paymentTypes": [
      "CARD"
    ]
  };

  const requestOptions = {
    url: url + payid + '/singleusecustomertokens',
    headers: headers,
    body: JSON.stringify(data),
    method: 'POST'
  };

  request(requestOptions, (err, res, body) => {
    return callbackfunc(JSON.parse(body).singleUseCustomerToken);
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

  const requestOptions = {
    url: url,
    headers: headers,
    body: JSON.stringify(data),
    method: 'POST'
  };

  request(requestOptions, (err, res, body) => {
    return callbackfunc(JSON.parse(body));
  });
}

app.post("/api/token", (req, res) => {
  User.findOne({ email: req.body.email }, async (err, user) => {
    if (err) {
      console.log(err);
    } else {
      if (!user) {
        await createPayid(req.body,
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
                await createToken(user.payid, function (result) {
                  res.send({ token: result });
                })
              }
            });
          });
      } else {
        await createToken(user.payid, function (result) {
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