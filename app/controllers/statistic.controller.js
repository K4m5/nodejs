const Order = require("../models/order.model.js");

class StatisticController {
    //[GET] /statistics/monthly_revenue
    async monthly_revenue(req, res) {
        try {
            const monthlyRevenue = await Order.aggregate([
                { $match: { status: "Completed" } }, // Filter for completed orders
                {
                    $group: {
                        _id: { $month: "$created_at" }, // Group by month of created_at
                        totalRevenue: { $sum: "$amount" } // Sum the amount for each month
                    }
                },
                {
                    $project: {
                        month: "$_id",
                        totalRevenue: 1,
                        _id: 0
                    }
                }
            ]);

            // Initialize an array of 12 elements, each set to 0
            const fullYearRevenue = Array.from({ length: 12 }, (_, i) => ({
                month: i + 1,
                totalRevenue: 0
            }));

            // Map aggregated results to the fullYearRevenue array
            monthlyRevenue.forEach(result => {
                fullYearRevenue[result.month - 1].totalRevenue = result.totalRevenue;
            });

            res.json(fullYearRevenue);
        } catch (error) {
            return res.status(500).json({ message: 'Error retrieving monthly revenue', error });
        }
    }

    //[GET] /statistics/monthly_order_count
    async monthly_order_count(req, res) {
        try {
            const monthlyOrderCount = await Order.aggregate([
                {
                    $group: {
                        _id: { $month: "$created_at" }, // Group by month of created_at
                        orderCount: { $sum: 1 } // Count each order as 1
                    }
                },
                {
                    $project: {
                        month: "$_id",
                        orderCount: 1,
                        _id: 0
                    }
                }
            ]);

            // Initialize an array of 12 elements, each set to 0
            const fullYearOrderCount = Array.from({ length: 12 }, (_, i) => ({
                month: i + 1,
                orderCount: 0
            }));

            // Map aggregated results to the fullYearOrderCount array
            monthlyOrderCount.forEach(result => {
                fullYearOrderCount[result.month - 1].orderCount = result.orderCount;
            });

            res.json(fullYearOrderCount);
        } catch (error) {
            return res.status(500).json({ message: 'Error retrieving monthly order count', error });
        }
    }

    //[GET] /statistics/current_revenue
    async current_revenue(req, res) {
        try {
            const today = new Date();
            const startOfDay = new Date(today.setHours(0, 0, 0, 0));
            const dayOfWeek = today.getDay();
            const daysSinceMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - daysSinceMonday);
            startOfWeek.setHours(0, 0, 0, 0);

            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

            const [dailyRevenue, weeklyRevenue, monthlyRevenue] = await Promise.all([
                Order.aggregate([
                    { $match: { status: "Completed", created_at: { $gte: startOfDay } } },
                    { $group: { _id: null, totalRevenue: { $sum: "$amount" } } },
                    { $project: { _id: 0, totalRevenue: { $ifNull: ["$totalRevenue", 0] } } }
                ]),
                Order.aggregate([
                    { $match: { status: "Completed", created_at: { $gte: startOfWeek } } },
                    { $group: { _id: null, totalRevenue: { $sum: "$amount" } } },
                    { $project: { _id: 0, totalRevenue: { $ifNull: ["$totalRevenue", 0] } } }
                ]),
                Order.aggregate([
                    { $match: { status: "Completed", created_at: { $gte: startOfMonth } } },
                    { $group: { _id: null, totalRevenue: { $sum: "$amount" } } },
                    { $project: { _id: 0, totalRevenue: { $ifNull: ["$totalRevenue", 0] } } }
                ])
            ]);

            res.json({
                dailyRevenue: dailyRevenue[0]?.totalRevenue || 0,
                weeklyRevenue: weeklyRevenue[0]?.totalRevenue || 0,
                monthlyRevenue: monthlyRevenue[0]?.totalRevenue || 0
            });
        } catch (error) {
            return res.status(500).json({ message: 'Error retrieving current revenue', error });
        }
    }

    //[GET] /statistics/current_order_count
    async current_order_count(req, res) {
        try {
            const today = new Date();
            const startOfDay = new Date(today.setHours(0, 0, 0, 0));
            const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

            const [dailyOrders, weeklyOrders, monthlyOrders] = await Promise.all([
                Order.aggregate([
                    { $match: { created_at: { $gte: startOfDay } } },
                    { $count: "orderCount" }
                ]),
                Order.aggregate([
                    { $match: { created_at: { $gte: startOfWeek } } },
                    { $count: "orderCount" }
                ]),
                Order.aggregate([
                    { $match: { created_at: { $gte: startOfMonth } } },
                    { $count: "orderCount" }
                ])
            ]);

            res.json({
                dailyOrders: dailyOrders[0]?.orderCount || 0,
                weeklyOrders: weeklyOrders[0]?.orderCount || 0,
                monthlyOrders: monthlyOrders[0]?.orderCount || 0
            });
        } catch (error) {
            return res.status(500).json({ message: 'Error retrieving current order count', error });
        }
    }

    //[GET] /statistics/percent
    async percent(req, res) {
        try {
            // Sử dụng aggregation để đếm số lượng từng trạng thái
            const orders = await Order.aggregate([
                {
                    $group: {
                        _id: "$status", // Nhóm theo trạng thái
                        count: { $sum: 1 }, // Đếm số lượng mỗi trạng thái
                    },
                },
                {
                    $project: {
                        status: "$_id",
                        count: 1,
                        _id: 0,
                    },
                },
            ]);
        
            // Lấy tổng số đơn hàng
            const totalOrders = orders.reduce((acc, item) => acc + item.count, 0);
        
            // Tạo một đối tượng map để chuyển đổi status sang tiếng Việt
            const statusTranslations = {
                "Pending": "Chờ xử lý",
                "Processing": "Đang xử lý",
                "Completed": "Hoàn thành",
                "Cancelled": "Đã hủy",
            };
        
            // Tính phần trăm và chuyển đổi status sang tiếng Việt
            const result = orders.map((item) => ({
                status: statusTranslations[item.status] || item.status, // Chuyển sang tiếng Việt
                percent: ((item.count / totalOrders) * 100).toFixed(2), // Làm tròn 2 chữ số
            }));
        
            return res.status(200).json({ totalOrders, result });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    //[GET] /statistics/revenue_day_of_month
    async revenue_day_of_month(req, res) {
        try {
            // Lấy tháng và năm từ query, nếu không có thì mặc định là tháng & năm hiện tại
            const month = parseInt(req.query.month) || new Date().getMonth() + 1;
            const year = parseInt(req.query.year) || new Date().getFullYear();
    
            // Xác định ngày bắt đầu và kết thúc tháng theo UTC
            const startDate = new Date(Date.UTC(year, month - 1, 1)); // Ngày 1 của tháng (UTC)
            const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59)); // Ngày cuối cùng của tháng (UTC)
    
            // Truy vấn tổng doanh thu theo từng ngày trong tháng theo múi giờ Việt Nam
            const revenueByDay = await Order.aggregate([
                {
                    $match: {
                        created_at: { 
                            $gte: startDate,
                            $lte: endDate
                        },
                        status: "Completed" // Chỉ tính đơn hàng đã hoàn thành
                    }
                },
                {
                    $project: {
                        created_at_vn: {
                            $dateAdd: {
                                startDate: "$created_at",
                                unit: "hour",
                                amount: 7 // Cộng thêm 7 giờ để chuyển sang giờ Việt Nam
                            }
                        },
                        amount: 1
                    }
                },
                {
                    $group: {
                        _id: { $dayOfMonth: "$created_at_vn" }, // Lấy ngày theo giờ Việt Nam
                        totalRevenue: { $sum: "$amount" } // Tổng doanh thu theo ngày
                    }
                },
                {
                    $sort: { _id: 1 }
                },
                {
                    $project: {
                        day: "$_id",
                        totalRevenue: 1,
                        _id: 0
                    }
                }
            ]);
    
            // Tạo một mảng chứa tất cả các ngày trong tháng
            const totalDays = new Date(year, month, 0).getDate();
            const allDays = Array.from({ length: totalDays }, (_, index) => index + 1);
    
            // Đảm bảo danh sách ngày đầy đủ, gán doanh thu là 0 nếu ngày đó không có dữ liệu
            const revenueResult = allDays.map(day => {
                const data = revenueByDay.find(item => item.day === day);
                return {
                    day,
                    totalRevenue: data ? data.totalRevenue : 0
                };
            });
    
            return res.status(200).json({
                month,
                year,
                revenueByDay: revenueResult
            });
    
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }
    
}

module.exports = new StatisticController();
