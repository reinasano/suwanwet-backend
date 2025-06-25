require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); 

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json()); 
app.use(cors()); // อนุญาต CORS สำหรับทุก Origin (สำหรับการพัฒนา)

// เชื่อมต่อกับ MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected successfully!'))
    .catch(err => console.error('MongoDB connection error:', err));

// กำหนด Order Schema (โครงสร้างข้อมูลของออเดอร์ใน MongoDB)
const orderSchema = new mongoose.Schema({
    items: [{
        name: String,
        price: Number,
        qty: Number
    }],
    pickupTime: String,
    note: String,
    time: { type: Date, default: Date.now }, 
    status: { type: String, default: 'pending' } // 'pending' หรือ 'completed'
});

const Order = mongoose.model('Order', orderSchema);

// === API Routes ทั้งหมดจะอยู่ตรงนี้ ===

// 1. POST /api/orders: รับออเดอร์ใหม่จากลูกค้า
app.post('/api/orders', async (req, res) => {
    try {
        const newOrder = new Order(req.body);
        await newOrder.save();
        res.status(201).json({ message: 'Order received successfully!', order: newOrder });
    } catch (error) {
        console.error('Error saving order:', error);
        res.status(500).json({ message: 'Failed to save order', error: error.message });
    }
});

// 2. GET /api/admin/orders: ดึงออเดอร์ทั้งหมดสำหรับหน้า Admin
app.get('/api/admin/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ time: -1 }); // ดึงทั้งหมดและเรียงจากใหม่ไปเก่า
        res.status(200).json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Failed to fetch orders', error: error.message });
    }
});

// 3. PUT /api/admin/orders/:id/status: อัปเดตสถานะออเดอร์
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
        res.status(200).json({ message: 'Order status updated successfully!', order: updatedOrder });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Failed to update order status', error: error.message });
    }
});

// 4. DELETE /api/admin/orders/:id: ลบออเดอร์
app.delete('/api/admin/orders/:id', async (req, res) => {
    try {
        const orderId = req.params.id; // ดึง ID ของออเดอร์จาก URL
        const deletedOrder = await Order.findByIdAndDelete(orderId); // ใช้ Mongoose ในการลบ

        if (!deletedOrder) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.status(200).json({ message: 'Order deleted successfully', deletedOrder });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ message: 'Failed to delete order', error: error.message });
    }
});

// Root route สำหรับทดสอบว่า Server ทำงานอยู่
app.get('/', (req, res) => {
    res.send('Suwanwet Farm Backend API is running!');
});

// เริ่มต้น Server
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});