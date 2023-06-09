const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

//Please add .env file in .gitignore
//DB_USER
//DB_PASSWORD

//Middleware
app.use(cors());
app.use(express.json());




const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.mjpzktk.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const usersCollection = client.db("yoganeDb").collection("users");
        const classesCollection = client.db("yoganeDb").collection("classes");
        const paymentCollection = client.db("yoganeDb").collection("payment");
        const selectClassCollection = client.db("yoganeDb").collection("selectClass");

        // create jwt token
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '10d' })

            res.send({ token })
        })

        app.get('/classes', async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result);
        })

        // users all api
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const exitUser = await usersCollection.findOne(query);

            if (exitUser) {
                return res.send({ message: 'user already exists' })
            }

            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        // user selectclass api
        app.get('/selectclass', async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }

            // const decodedEmail = req.decoded.email;
            // if (email !== decodedEmail) {
            //   return res.status(403).send({ error: true, message: 'forbidden access' })
            // }

            const query = { email: email };
            const result = await selectClassCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/selectclass/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id)
            const query = { _id: ObjectId(id) }
            const booking = await selectClassCollection.findOne(query);
            res.send(booking)
        })

        app.post('/selectclass', async (req, res) => {
            const selectClass = req.body;
            const result = await selectClassCollection.insertOne(selectClass);
            res.send(result);
        })

        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ],
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        app.post('/payment', async (req, res) => {
            const payment = req.body;
            console.log(payment)
            const result = await paymentCollection.insertOne(payment);
            const id = payment.paymentId
            const filter = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updatedResult = await selectClassCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.delete('/selectclass/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await selectClassCollection.deleteOne(query);
            res.send(result);
        })


    } finally {
        // await client.close();
    }
}
run().catch(console.dir);




app.get("/", (req, res) => {
    res.send("Hello World from Example app");
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});