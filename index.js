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

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}


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

        //  use verifyAdmin after use verifyJWT for all admin api
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        //  //  use verifyInstructor after use verifyJWT for all admin api
        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        app.get('/classes', async (req, res) => {
            const email = req.query.email;
            if (email) {
                const query = {
                    instructorEmail: email
                };
                const result = await classesCollection.find(query).toArray();
                res.send(result);
            }
            else {
                const result = await classesCollection.find().toArray();
                res.send(result);
            }
        })
        app.post('/classes', verifyJWT, verifyInstructor, async (req, res) => {
            const classes = req.body;
            const result = await classesCollection.insertOne(classes);
            res.send(result);
        })

        // users all api
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            console.log(result)
            res.send(result);
        })
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const exitUser = await usersCollection.findOne(query);

            if (exitUser) {
                return res.send({ message: 'user already exists' })
            }

            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        // check admin
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            // const result = { admin: user?.role}
            const result = { admin: user?.role === 'admin' }
            res.send(result);
        })

        // check instructor
        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            // const result = { instructor: user?.role}
            const result = { instructor: user?.role === 'instructor' }

            res.send(result);
        })

        // admins api
        app.put('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options)
            res.send(result);

        });

        // class status change api by admin
        app.put('/users/approve/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    status: 'aproved'
                }
            }
            const result = await classesCollection.updateOne(filter, updatedDoc, options)
            res.send(result);

        });

        app.put('/users/deny/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    status: 'denied'
                }
            }
            const result = await classesCollection.updateOne(filter, updatedDoc, options)
            res.send(result);

        });

        // admin feedback in instructor class
        app.put('/feedback/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id)
            const feedbackInfo = req.body.value;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    feedback: feedbackInfo
                }
            }
            const result = await classesCollection.updateOne(filter, updatedDoc, options)
            res.send(result);

        });

        // user make instructor api
        app.put('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    role: 'instructor'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options)
            res.send(result);

        });

        // user selectclass api
        app.get('/selectclass', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }

            const query = { email: email };
            const result = await selectClassCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/selectclass/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
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

        app.get('/payment', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }
            const query = { email: email };
            const result = await paymentCollection.find(query).sort({ date: -1 }).toArray();
            res.send(result);

        })

        app.post('/payment', async (req, res) => {
            const payment = req.body;
            const classId = payment.paymentId;
            const selectedId = payment.selectedId;
            const classIdFilter = { _id: new ObjectId(classId) }
            const selectedIdFilter = { _id: new ObjectId(selectedId) }

            // store payment data in payment collection
            const result = await paymentCollection.insertOne(payment);

            // find the class from classCollection to decrease available seats and increase enroll student
            const classes = await classesCollection.findOne(classIdFilter);
            const options = { upsert: true }
            const update = {
                $set: {
                    studentNumber: classes.studentNumber + 1,
                    availableSeats: classes.availableSeats - 1
                }
            }
            const updateResult = await classesCollection.updateOne(classIdFilter, update, options);

            // selectedClasses updated after fulfilPayment
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                    instructorName: payment.instructorName
                }
            }
            const updatedResult = await selectClassCollection.updateOne(selectedIdFilter, updatedDoc);
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