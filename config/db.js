import mongoose from "mongoose"

//function to connect to the database
export async function connectDB() {
    try {
        const atlas_string = process.env.ATLAS_STRING;
        await mongoose.connect(atlas_string);
        console.log("Mongodb connected successfully");
    }
   catch (error) {
        console.error("Connection error: ", error);
    }
}