import connectDb from "./db/index.js"
import dotenv from "dotenv"
dotenv.config({
    path: "./.env"
})


connectDb()
.then(()=>{
    app.listen(process.env.PORT || 8000,()=>{
        console.log(`Server is running at port: ${process.env.PORT}`);
    })
})
.catch((err)=>{
    console.log("MONGO DB connection failed !!",err);  
})








// import express from "express"
// const app = express()
// ( async () => {
//     try{
//         await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
//         app.on("error",(error)=>{
//             console.log("ERROR:",error);
//             throw error
//         })

//         app.listen(process.env.PORT,()=>{
//         console.log(`App is listening on port ${process.env.PORT}`);
        
//     })
//     }
//     catch(error){
//         console.error("Error is:",error);
//         throw error
//     }
// } )()
