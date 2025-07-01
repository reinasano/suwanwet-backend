require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fetch = require('node-fetch'); // Import node-fetch for making HTTP requests

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors()); // Allow CORS for all Origins (for development)

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected successfully!'))
    .catch(err => console.error('MongoDB connection error:', err));

// Define Order Schema (Data structure for orders in MongoDB)
const orderSchema = new mongoose.Schema({
    items: [{
        // Modified here: Added nameTh and nameEn to the Schema
        nameTh: { type: String, required: true },
        nameEn: { type: String, required: true },
        price: { type: Number, required: true },
        qty: { type: Number, required: true }
    }],
    pickupTime: String,
    note: String,
    time: { type: Date, default: Date.now },
    status: { type: String, default: 'pending' } // 'pending' or 'completed'
});

const Order = mongoose.model('Order', orderSchema);

// === All API Routes will be here ===

// IMPORTANT: Replace this with your Google Apps Script Web App URL
// You obtained this URL after deploying your Apps Script in the previous step.
const GOOGLE_SHEET_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbygkgT-_RwpV_xtNl8csmyNJPgWJwBpgp0PuOkkQE5t6PGmwmfAJJjz4g24H2Iw282ZaQ/exec'; 

// 1. POST /api/orders: Receive new orders from customers
app.post('/api/orders', async (req, res) => {
    try {
        // Mongoose will automatically map req.body to the Schema
        // Ensure each req.body.items has nameTh, nameEn, price, qty
        const newOrder = new Order(req.body);
        await newOrder.save();

        // --- Start: Added code to send order to Google Sheet ---
        try {
            const sheetData = {
                action: 'newOrder', // Indicate this is a new order
                orderId: newOrder._id.toString(), // Convert ObjectId to string
                orderTime: newOrder.time.toLocaleString('th-TH'), // Format date for Thai locale
                pickupTime: newOrder.pickupTime || "ไม่ได้ระบุ",
                customerNote: newOrder.note || "",
                // Create a single string for item list
                itemsList: newOrder.items.map(item => `${item.nameTh} (${item.nameEn}) x ${item.qty} ชิ้น`).join(', '),
                totalPrice: newOrder.items.reduce((sum, item) => sum + (item.qty * item.price), 0),
                status: newOrder.status
            };

            const sheetResponse = await fetch(GOOGLE_SHEET_WEB_APP_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sheetData),
            });

            if (sheetResponse.ok) {
                console.log('Order data sent to Google Sheet successfully.');
            } else {
                const errorText = await sheetResponse.text();
                console.error('Failed to send order data to Google Sheet. Status:', sheetResponse.status, 'Response:', errorText);
            }
        } catch (sheetError) {
            console.error('Error sending new order data to Google Sheet:', sheetError);
            // It's not necessary to fail the main request if sending to sheet fails
        }
        // --- End: Added code to send order to Google Sheet ---

        res.status(201).json({ message: 'Order received successfully!', order: newOrder });
    } catch (error) {
        console.error('Error saving order:', error);
        res.status(500).json({ message: 'Failed to save order', error: error.message });
    }
});

// 2. GET /api/admin/orders: Fetch all orders for Admin page
app.get('/api/admin/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ time: -1 }); // Fetch all and sort from new to old
        res.status(200).json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Failed to fetch orders', error: error.message });
    }
});

// 3. PUT /api/admin/orders/:id/status: Update order status
app.put('/api/admin/orders/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['pending', 'completed'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status provided.' });
        }

        const updatedOrder = await Order.findByIdAndUpdate(id, { status: status }, { new: true });

        if (!updatedOrder) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        // --- Start: Added code to update status in Google Sheet ---
        try {
            const sheetData = {
                action: 'updateStatus', // Indicate this is a status update
                orderId: updatedOrder._id.toString(),
                newStatus: updatedOrder.status
            };

            const sheetResponse = await fetch(GOOGLE_SHEET_WEB_APP_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sheetData),
            });

            if (sheetResponse.ok) {
                console.log('Order status updated in Google Sheet successfully.');
            } else {
                const errorText = await sheetResponse.text();
                console.error('Failed to update order status in Google Sheet. Status:', sheetResponse.status, 'Response:', errorText);
            }
        } catch (sheetError) {
            console.error('Error updating order status in Google Sheet:', sheetError);
        }
        // --- End: Added code to update status in Google Sheet ---

        res.status(200).json({ message: 'Order status updated successfully!', order: updatedOrder });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Failed to update order status', error: error.message });
    }
});

// 4. DELETE /api/admin/orders/:id: Delete order
app.delete('/api/admin/orders/:id', async (req, res) => {
    try {
        const orderId = req.params.id; // Get order ID from URL
        const deletedOrder = await Order.findByIdAndDelete(orderId); // Use Mongoose to delete

        if (!deletedOrder) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Note: For deletion, you might also want to send a signal to Google Sheet
        // to mark the row as deleted or remove it, but this requires more complex Apps Script logic.
        // For simplicity, we are not adding Google Sheet deletion logic here.

        res.status(200).json({ message: 'Order deleted successfully', deletedOrder });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ message: 'Failed to delete order', error: error.message });
    }
});

// Root route to test if Server is running
app.get('/', (req, res) => {
    res.send('Suwanwet Farm Backend API is running!');
});

// Start Server
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
