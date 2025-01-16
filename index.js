const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://hotel-hive9340.web.app',
  ],
  credentials: true,
  // optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: 'unauthorized api access' });
  }
  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        console.log(err);
        return res.status(401).send({ message: 'unauthorized access' });
      }
      console.log(jwt.decoded);
      req.user = decoded;
      next();
    });
  }
};

app.get('/', (req, res) => {
  res.send('Hotel Hive is running successfully!');
});
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.plyw3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const HotelCollection = client.db('HotelHiveDB').collection('rooms');
    const BookingCollection = client.db('HotelHiveDB').collection('booking');
    const ReviewCollection = client.db('HotelHiveDB').collection('rating');
    app.get('/rooms', async (req, res) => {
      const cursor = HotelCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1d',
      });
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true });
    });

    app.get('/logout', (req, res) => {
      res
        .clearCookie('token', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          maxAge: 0,
        })
        .send({ success: true });
    });

    app.get('/room/:lowValue/:highValue', async (req, res) => {
      const lowValue = parseInt(req.params.lowValue);
      const highValue = parseInt(req.params.highValue);
      const query = { pricePerNight: { $gte: lowValue, $lte: highValue } };
      const result = await HotelCollection.find(query).toArray();
      res.send(result);
    });

    app.get('/rooms/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await HotelCollection.findOne(query);
      res.send(result);
    });

    app.put('/rooms/update/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const { status } = req.body;
      const updateAvailable = {
        $set: {
          availability: status,
        },
      };
      const result = await HotelCollection.updateOne(
        filter,
        updateAvailable,
        options
      );
      res.send(result);
    });

    app.put('/rooms/review/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const { review } = req.body;
      const updateAvailable = {
        $push: {
          reviews: review,
        },
      };
      const result = await HotelCollection.updateOne(filter, updateAvailable);
      res.send(result);
    });

    app.get('/review', async (req, res) => {
      const result = await ReviewCollection.find()
        .sort({ timestamp: -1 })
        .toArray();
      res.send(result);
    });

    app.get('/review/:id', async (req, res) => {
      const id = req.params.id;
      const query = { id: id };
      const result = await ReviewCollection.find(query).toArray();
      res.send(result);
    });

    app.post('/rooms/review/:id', async (req, res) => {
      const { review } = req.body;
      const result = await ReviewCollection.insertOne(review);
      res.send(result);
    });

    //booking related

    app.get('/booking', async (req, res) => {
      const result = await BookingCollection.find().toArray();
      res.send(result);
    });

    app.get('/my-booking', verifyToken, async (req, res) => {
      const email = req.query.email;
      const tokenEmail = req?.user?.email;
      if (tokenEmail !== email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      console.log(email);
      const query = { email: email };
      const cursor = BookingCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post('/booking', async (req, res) => {
      const bookingInfo = req.body;
      const result = await BookingCollection.insertOne(bookingInfo);
      res.send(result);
    });

    app.put('/my-booking/update/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const { date } = req.body;
      const updateAvailable = {
        $set: {
          date: date,
        },
      };
      const result = await BookingCollection.updateOne(
        filter,
        updateAvailable,
        options
      );
      res.send(result);
    });

    app.delete('/my-booking/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await BookingCollection.deleteOne(query);
      res.send(result);
    });

    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
// run().catch(console.dir);

app.listen(port, () => {
  console.log(`Hotel Hive server listening on port ${port}`);
});
