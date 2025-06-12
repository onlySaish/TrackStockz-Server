import connectDB from "./DB/index.js";
import dotenv from 'dotenv'
import {app} from "./app.js";

dotenv.config({
    path: './.env'
})

const port = process.env.PORT || 8000;

connectDB()
.then((res) => {
    app.listen(port, () => {
        console.log("App is Listening at Port ",port);
    })
}).catch((err) => {
  console.log("DB Connection Error",err);
});