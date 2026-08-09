// Employee Leave Management Module
// Created by Fullstack Developer AI Agent
const express = require('express')
let mongodb = require('mongodb')
//import url
let url = require('../url')
//create mongoclient
let mcl = mongodb.MongoClient
//create router instance
let router = express.Router()
//create rest api

// GET - Fetch all leaves
router.get("/", (req, res) => {
    //connect to mongodb
    mcl.connect(url, (err, conn) => {
        if (err)
            console.log('Error in connection :- ', err)
        else {
            let db = conn.db('nodeedb')
            db.collection('Leaves').find().toArray((err, array) => {
                if (err)
                    console.log('Error :- ' + err)
                else {
                    console.log('Data sent')
                    res.json(array)
                    conn.close()
                }
            })
        }
    })
})

// POST - Insert a new leave
router.post("/insert", (req, res) => {
    let obj = {
        "employeeName": req.body.employeeName,
        "leaveType": req.body.leaveType,
        "startDate": req.body.startDate,
        "endDate": req.body.endDate,
        "status": req.body.status || "Pending",
        "reason": req.body.reason,
        "createdAt": new Date()
    }
    //connect to MongoDB
    mcl.connect(url, (err, conn) => {
        if (err)
            console.log('Error in connection :- ', err)
        else {
            let db = conn.db("nodeedb")
            db.collection('Leaves').insertOne(obj, (err) => {
                if (err)
                    res.json({'insert': 'Error ' + err})
                else {
                    console.log("Leave inserted")
                    res.json({'insert': 'success'})
                    conn.close()
                }
            })
        }
    })
})

// POST - Update leave status
router.post("/update", (req, res) => {
    let p_id = req.body._id
    let obj = {
        "status": req.body.status
    }
    //connect to mongodb
    mcl.connect(url, (err, conn) => {
        if (err)
            console.log('Error in connection:- ', err)
        else {
            let db = conn.db("nodeedb")
            db.collection("Leaves").updateOne({ _id: new mongodb.ObjectId(p_id) }, { $set: obj }, (err, result) => {
                if (err)
                    res.json({ 'update': 'Error ' + err })
                else {
                    if (result.matchedCount != 0) {
                        console.log("Leave updated ")
                        res.json({ 'update': 'success' })
                    }
                    else {
                        console.log("Leave Not updated ")
                        res.json({ 'update': 'Record Not found' })
                    }
                    conn.close()
                }
            })
        }
    })
})

// POST - Delete a leave
router.post("/delete", (req, res) => {
    let obj = {
        "_id": new mongodb.ObjectId(req.body._id)
    }
    //connect to mongodb
    mcl.connect(url, (err, conn) => {
        if (err)
            console.log('Error in connection:- ', err)
        else {
            let db = conn.db('nodeedb')
            db.collection('Leaves').deleteOne(obj, (err, result) => {
                if (err)
                    res.json({ 'delete': 'Error ' + err })
                else {
                    if (result.deletedCount != 0) {
                        console.log('Leave deleted')
                        res.json({ 'delete': 'success' })
                    }
                    else {
                        console.log('Leave Not deleted')
                        res.json({ 'delete': 'Record Not found' })
                    }
                    conn.close()
                }
            })
        }
    })
})

//export router
module.exports = router