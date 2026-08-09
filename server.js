// import module express body-parser cors
let express = require('express')
let bodyparser = require('body-parser')
let cors = require('cors')
//create rest object
let app = express()
//set JSON as MIME type
app.use(bodyparser.json())
//client is not sending from data -> encoding JSON
app.use(bodyparser.urlencoded({extended : false}))
// enable CORS -> Cross Origin Resource Sharing -> commmunication among various ports
app.use(cors())
//create port
let port = process.env.PORT || 8080
//import fetch insert update delete modules
let fetch = require('./fetch/fetch')
let insert = require('./insert/insert')
let update = require('./update/update')
let remove = require('./delete/delete')
let leave = require('./leave/leave')
let health = require('./health/health')
//use above modules
app.use("/fetch", fetch)
app.use("/insert", insert)
app.use("/update", update)
app.use("/delete", remove)
app.use("/leaves", leave)
app.use("/health", health)
//assign port no
app.listen(port, () => {
    console.log("Server listening port no:- ", port)
})
/*
    >node server
    Test following URLS with postman
    http://localhost:8080/fetch     (get)
    http://localhost:8080/insert    |
    http://localhost:8080/update    |(post)
    http://localhost:8080/delete    |

    body -> raw -> json

*/