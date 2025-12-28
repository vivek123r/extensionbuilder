import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  doc,
  query, 
  where, 
  orderBy,
  deleteDoc,
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';

// Collection name
const EXTENSIONS_COLLECTION = 'extensions';

/**
 * Save a new extension to Firestore
 * @param {string} userId - The user's ID
 * @param {object} extensionData - Extension data including formData and generatedCode
 * @returns {Promise<string>} - Returns the document ID of the saved extension
 */
export const saveExtension = async (userId, extensionData) => {
  try {
    const extensionDoc = {
      userId,
      name: extensionData.name,
      description: extensionData.description,
      version: extensionData.version,
      type: extensionData.type,
      permissions: extensionData.permissions || [],
      author: extensionData.author,
      targetBrowser: extensionData.targetBrowser,
      generatedCode: extensionData.generatedCode,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, EXTENSIONS_COLLECTION), extensionDoc);
    console.log('Extension saved with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving extension:', error);
    throw error;
  }
};

/**
 * Get all extensions for a specific user
 * @param {string} userId - The user's ID
 * @returns {Promise<Array>} - Returns array of user's extensions
 */
export const getUserExtensions = async (userId) => {
  try {
    const q = query(
      collection(db, EXTENSIONS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const extensions = [];

    querySnapshot.forEach((doc) => {
      extensions.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return extensions;
  } catch (error) {
    console.error('Error getting user extensions:', error);
    throw error;
  }
};

/**
 * Get a specific extension by ID
 * @param {string} extensionId - The extension document ID
 * @returns {Promise<object>} - Returns the extension data
 */
export const getExtensionById = async (extensionId) => {
  try {
    const docRef = doc(db, EXTENSIONS_COLLECTION, extensionId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      };
    } else {
      throw new Error('Extension not found');
    }
  } catch (error) {
    console.error('Error getting extension:', error);
    throw error;
  }
};

/**
 * Update an existing extension
 * @param {string} extensionId - The extension document ID
 * @param {object} updateData - Data to update
 * @returns {Promise<void>}
 */
export const updateExtension = async (extensionId, updateData) => {
  try {
    const docRef = doc(db, EXTENSIONS_COLLECTION, extensionId);
    await updateDoc(docRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
    console.log('Extension updated successfully');
  } catch (error) {
    console.error('Error updating extension:', error);
    throw error;
  }
};

/**
 * Delete an extension
 * @param {string} extensionId - The extension document ID
 * @returns {Promise<void>}
 */
export const deleteExtension = async (extensionId) => {
  try {
    const docRef = doc(db, EXTENSIONS_COLLECTION, extensionId);
    await deleteDoc(docRef);
    console.log('Extension deleted successfully');
  } catch (error) {
    console.error('Error deleting extension:', error);
    throw error;
  }
};

/**
 * Get extension count for a user
 * @param {string} userId - The user's ID
 * @returns {Promise<number>} - Returns count of user's extensions
 */
export const getExtensionCount = async (userId) => {
  try {
    const q = query(
      collection(db, EXTENSIONS_COLLECTION),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('Error getting extension count:', error);
    throw error;
  }
};
