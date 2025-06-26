import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";


const connectDb = async ()=> {
    try{
       const connectInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
       console.log(`\n MongoDB connected !! DB HOST: ${connectInstance.connection.host} \n`);
    }
    catch(error){
        console.log("MONGODB connectection error:",error);
        process.exit(1);   
    }
}
export default connectDb;