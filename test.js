// import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react"
// import * as cartService from "../api/services/cart.service"
// import { useAuth } from "./AuthContext"

// const CartContext = createContext(null)

// export const CartProvider = ({ children }) => {
//     const { isAuthenticated } = useAuth()
//     const [items, setItems] = useState([]) // [{ product: {...}, quantity }]
//     const [isLoading, setIsLoading] = useState(false)

//     const fetchCart = useCallback(async () => {
//         if (!isAuthenticated) {
//             setItems([])
//             return
//         }
//         setIsLoading(true)
//         try {
//             const data = await cartService.getCart()
//             setItems(data?.items || [])
//         } catch (err) {
//             console.error("fetchCart error:", err.message)
//         } finally {
//             setIsLoading(false)
//         }
//     }, [isAuthenticated])

//     useEffect(() => {
//         fetchCart()
//     }, [fetchCart])

//     const addItem = useCallback(async (productId, quantity = 1) => {
//         try {
//             const updatedCart = await cartService.addToCart(productId, quantity)
//             setItems(updatedCart?.items || [])
//         } catch (err) {
//             console.error("addItem error:", err.message)
//             throw err
//         }
//     }, [])

//     const updateQuantity = useCallback(async (productId, quantity) => {
//         const previousItems = items
//         setItems((prev) =>
//             quantity <= 0
//                 ? prev.filter((item) => item.product._id !== productId)
//                 : prev.map((item) => item.product._id === productId ? { ...item, quantity } : item)
//         )
//         try {
//             const updatedCart = await cartService.updateCartQuantity(productId, quantity)
//             setItems(updatedCart?.items || [])
//         } catch (err) {
//             setItems(previousItems)
//             console.error("updateQuantity error:", err.message)
//         }
//     }, [items])

//     const removeItem = useCallback(async (productId) => {
//         const previousItems = items
//         setItems((prev) => prev.filter((item) => item.product._id !== productId))
//         try {
//             const updatedCart = await cartService.removeFromCart(productId)
//             setItems(updatedCart?.items || [])
//         } catch (err) {
//             setItems(previousItems)
//             console.error("removeItem error:", err.message)
//         }
//     }, [items])

//     const clearCart = useCallback(async () => {
//         const previousItems = items
//         setItems([])
//         try {
//             await cartService.clearCart()
//         } catch (err) {
//             setItems(previousItems)
//             console.error("clearCart error:", err.message)
//         }
//     }, [items])

//     const totalItems = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items])
//     const totalPrice = useMemo(() => items.reduce((sum, item) => sum + item.quantity * (item.product?.price || 0), 0), [items])

//     const value = { items, isLoading, totalItems, totalPrice, addItem, updateQuantity, removeItem, clearCart, refetchCart: fetchCart }

//     return <CartContext.Provider value={value}>{children}</CartContext.Provider>
// }

// export const useCart = () => {
//     const context = useContext(CartContext)
//     if (!context) throw new Error("useCart must be used within a CartProvider")
//     return context
// }

