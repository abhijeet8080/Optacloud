const dotenv = require("dotenv");
const connectDatabase = require("./db/database");
// Load environment variables first
dotenv.config({ path: "./config.env" });
const app = require("./app");


const PORT = process.env.PORT || 5000;

connectDatabase();
app.listen(PORT,()=>{
    console.log(`Sever is listening on Port: ${PORT}`)
})