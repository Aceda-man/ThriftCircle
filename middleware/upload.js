import multer from "multer";

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "application/pdf"];
        if (!allowed.includes(file.mimetype)) {
            const err = new Error("Only JPEG, PNG, or PDF files are allowed."); 
            err.statusCode = 400;                                               
            return cb(err);                                                     
        }
        cb(null, true);
    }
});

export default upload;