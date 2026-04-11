import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { Landing } from './pages/Landing'
import { GroupHome } from './pages/GroupHome'
import { AddReceipt } from './pages/AddReceipt'
import { ReceiptDetail } from './pages/ReceiptDetail'
import { SettleUp } from './pages/SettleUp'
import { History } from './pages/History'

export default function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/group/:joinCode" element={<GroupHome />} />
          <Route path="/group/:joinCode/add" element={<AddReceipt />} />
          <Route path="/group/:joinCode/receipt/:id" element={<ReceiptDetail />} />
          <Route path="/group/:joinCode/settle" element={<SettleUp />} />
          <Route path="/group/:joinCode/history" element={<History />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            borderRadius: '14px',
            background: '#0f172a',
            color: '#f8fafc',
            fontSize: '14px',
            fontWeight: 500,
            maxWidth: '360px',
            boxShadow: '0 10px 40px rgba(15, 23, 42, 0.25)',
          },
        }}
      />
    </>
  )
}
