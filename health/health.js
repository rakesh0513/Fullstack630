// health check module
let express = require('express')
let router = express.Router()

// GET /health - returns application status as JSON
router.get("/", (req, res) => {
    res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString()
    })
})

module.exports = router