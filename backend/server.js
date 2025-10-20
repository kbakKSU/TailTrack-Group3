require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const morgan = require('morgan');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tailtrack';
mongoose.connect(uri)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err.message));

app.use('/api/exercises', require('./routes/exercise.routes'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 API running at http://localhost:${PORT}`));