import {v2 as cloudinary} from 'cloudinary'
import fs from 'fs'
import {ApiError} from './ApiError.js'

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET_KEY
})

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: 'auto'
        })
        fs.unlinkSync(localFilePath);
        return response;    
    } catch (error) {
        fs.unlink(localFilePath) 
    }
}

const getPublicIdFromUrl = async(filePath) => {
    try {
        const parts = filePath.split("/");
            const versionIndex = parts.findIndex((part,index) => part.startsWith("v") && parts[index+1]?.includes("."));
            const publicIdwithExtension = parts.slice(versionIndex+1).join("/");
            const publicId = publicIdwithExtension.replace(/\.[^/.]+$/, '');
            return publicId;
    } catch (error) {
        throw new ApiError(400, "Error getting public id from url")
    }
}

    const deleteFromCloudinary = async(publicId, resource = "auto") => {
        try {
            if (!publicId) return null;
            const response = await cloudinary.uploader.destroy(publicId,{
                resource_type: resource 
            })
            return response;
        } catch (error) {
            console.log(error)
            throw new ApiError(400, "Error Deleting old file from cloudinary")
        }
    }

export  {
    uploadOnCloudinary,
    getPublicIdFromUrl,
    deleteFromCloudinary
};