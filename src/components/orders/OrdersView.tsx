import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  Phone, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Eye, 
  Edit2, 
  Trash2, 
  Printer, 
  Share2, 
  ChevronRight, 
  ArrowUpDown,
  Filter,
  DollarSign,
  Package,
  CalendarClock
} from 'lucide-react';
import { CustomerOrder, CustomerOrderItem, CustomerOrderStatus, Product, UserProfile } from '../../types';
import { 
  ORDER_STATUS_CONFIG, 
  generateOrderNumber, 
  getOrderTimingStatus, 
  calculateOrderAmounts, 
  formatOrderItemsSummary, 
  generateWhatsAppOrderMessage,
  isOrderActive
} from '../../lib/customerOrders';
import { getKolkataDateString } from '../../lib/utils';
import { normalizeWhatsAppPhoneNumber } from '../../lib/phoneUtils';

interface OrdersViewProps {
  orders: CustomerOrder[];
  products: Product[];
  currentUser: UserProfile;
  onCreateOrder: (order: CustomerOrder) => Promise<boolean>;
  onUpdateOrder: (order: CustomerOrder) => Promise<boolean>;
  onUpdateOrderStatus: (orderId: string, status: CustomerOrderStatus) => Promise<boolean>;
  onCancelOrder: (orderId: string) => Promise<boolean>;
  initialFilter?: 'all' | 'due_today' | 'upcoming' | 'overdue';
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  products,
  currentUser,
  onCreateOrder,
  onUpdateOrder,
  onUpdateOrderStatus,
  onCancelOrder,
  initialFilter = 'all',
}) => {
  const todayStr = getKolkataDateString();

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [timingFilter, setTimingFilter] = useState<'all' | 'due_today' | 'upcoming' | 'overdue'>(initialFilter);
  
  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<CustomerOrder | null>(null);
  const [selectedOrderForView, setSelectedOrderForView] = useState<CustomerOrder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderDate, setOrderDate] = useState(todayStr);
  const [deliveryDate, setDeliveryDate] = useState(todayStr);
  const [deliveryTime, setDeliveryTime] = useState('Evening (5 PM - 8 PM)');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderItems, setOrderItems] = useState<CustomerOrderItem[]>([]);
  const [advancePaid, setAdvancePaid] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<CustomerOrderStatus>('Pending');

  // Item selector in form
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [itemQty, setItemQty] = useState<number>(1);
  const [itemPrice, setItemPrice] = useState<number>(0);
  const [itemNotes, setItemNotes] = useState<string>('');
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState<boolean>(false);
  const productPickerRef = useRef<HTMLDivElement>(null);

  // Close product dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productPickerRef.current && !productPickerRef.current.contains(event.target as Node)) {
        setIsProductDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter products for dropdown
  const pickerFilteredProducts = useMemo(() => {
    const q = productSearchQuery.trim().toLowerCase();
    if (!q) return products.slice(0, 50);
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  }, [products, productSearchQuery]);

  const selectedProductObj = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Synchronize item price when product is selected
  const handleProductSelect = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setItemPrice(prod.sellingPrice || 0);
    }
    setProductSearchQuery('');
    setIsProductDropdownOpen(false);
  };

  // Add item to order
  const handleAddItem = () => {
    if (!selectedProductId) return;
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    const qty = Math.max(0.1, Number(itemQty) || 1);
    const price = Math.max(0, Number(itemPrice) || prod.sellingPrice);
    const subtotal = Math.round(qty * price * 100) / 100;

    const existingIndex = orderItems.findIndex((i) => i.productId === selectedProductId);
    if (existingIndex >= 0) {
      const updated = [...orderItems];
      const newQty = updated[existingIndex].quantity + qty;
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: newQty,
        unitPrice: price,
        subtotal: Math.round(newQty * price * 100) / 100,
        notes: itemNotes.trim() || updated[existingIndex].notes,
      };
      setOrderItems(updated);
    } else {
      setOrderItems([
        ...orderItems,
        {
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          barcode: prod.barcode,
          unit: prod.unit || 'KG',
          quantity: qty,
          unitPrice: price,
          subtotal,
          notes: itemNotes.trim() || undefined,
        },
      ]);
    }

    // Reset item selector
    setSelectedProductId('');
    setItemQty(1);
    setItemPrice(0);
    setItemNotes('');
    setProductSearchQuery('');
    setIsProductDropdownOpen(false);
  };

  // Remove item from order
  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, idx) => idx !== index));
  };

  // Open Add Order Modal
  const handleOpenAddOrder = () => {
    setEditingOrder(null);
    setFormError(null);
    setCustomerName('');
    setCustomerPhone('');
    setOrderDate(todayStr);
    setDeliveryDate(todayStr);
    setDeliveryTime('Evening (5 PM - 8 PM)');
    setDeliveryAddress('');
    setOrderItems([]);
    setAdvancePaid(0);
    setPaymentMethod('CASH');
    setNotes('');
    setStatus('Pending');
    setSelectedProductId('');
    setItemQty(1);
    setItemPrice(0);
    setItemNotes('');
    setProductSearchQuery('');
    setIsProductDropdownOpen(false);
    setIsFormModalOpen(true);
  };

  // Open Edit Order Modal
  const handleOpenEditOrder = (order: CustomerOrder) => {
    setEditingOrder(order);
    setFormError(null);
    setCustomerName(order.customerName);
    setCustomerPhone(order.customerPhone);
    setOrderDate(order.orderDate || todayStr);
    setDeliveryDate(order.deliveryDate || todayStr);
    setDeliveryTime(order.deliveryTime || '');
    setDeliveryAddress(order.deliveryAddress || '');
    setOrderItems(order.items || []);
    setAdvancePaid(order.advancePaid || 0);
    setPaymentMethod(order.paymentMethod || 'CASH');
    setNotes(order.notes || '');
    setStatus(order.status || 'Pending');
    setSelectedProductId('');
    setItemQty(1);
    setItemPrice(0);
    setItemNotes('');
    setProductSearchQuery('');
    setIsProductDropdownOpen(false);
    setIsFormModalOpen(true);
  };

  // Calculated totals for form
  const formCalculations = useMemo(() => {
    return calculateOrderAmounts(orderItems, 0, 0, advancePaid);
  }, [orderItems, advancePaid]);

  // Handle Form Submission
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = customerName.trim();
    if (!cleanName) {
      setFormError('Please enter customer name');
      return;
    }

    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setFormError('Please enter a valid 10-digit mobile number');
      return;
    }

    if (!deliveryDate || deliveryDate.trim() === '') {
      setFormError('Delivery date is required');
      return;
    }

    if (orderItems.length === 0) {
      setFormError('Please add at least one product item to the order');
      return;
    }

    setIsSubmitting(true);
    try {
      const orderPayload: CustomerOrder = {
        id: editingOrder ? editingOrder.id : `cord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        orderNumber: editingOrder ? editingOrder.orderNumber : generateOrderNumber(orders),
        customerName: cleanName,
        customerPhone: cleanPhone,
        items: formCalculations.validatedItems,
        subtotal: formCalculations.subtotal,
        discountAmount: formCalculations.discountAmount,
        gstAmount: formCalculations.gstAmount,
        totalAmount: formCalculations.totalAmount,
        advancePaid: formCalculations.advancePaid,
        balanceDue: formCalculations.balanceDue,
        orderDate: orderDate || todayStr,
        deliveryDate: deliveryDate,
        deliveryTime: deliveryTime.trim() || undefined,
        deliveryAddress: deliveryAddress.trim() || undefined,
        status: status,
        paymentMethod: paymentMethod,
        notes: notes.trim() || undefined,
        createdAt: editingOrder ? editingOrder.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      let success = false;
      if (editingOrder) {
        success = await onUpdateOrder(orderPayload);
      } else {
        success = await onCreateOrder(orderPayload);
      }

      if (success) {
        setIsFormModalOpen(false);
      } else {
        setFormError('Failed to save order. Please check connection and try again.');
      }
    } catch (err: any) {
      setFormError(err?.message || 'Error saving order');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Aggregate Counts for Top Summary Bar
  const stats = useMemo(() => {
    let active = 0;
    let dueToday = 0;
    let upcoming = 0;
    let overdue = 0;
    let totalAdvance = 0;
    let totalPendingBalance = 0;

    orders.forEach((o) => {
      const timing = getOrderTimingStatus(o, todayStr);
      if (isOrderActive(o)) {
        active++;
        totalAdvance += o.advancePaid;
        totalPendingBalance += o.balanceDue;
        if (timing === 'due_today') dueToday++;
        if (timing === 'upcoming') upcoming++;
        if (timing === 'overdue') overdue++;
      }
    });

    return { active, dueToday, upcoming, overdue, totalAdvance, totalPendingBalance };
  }, [orders, todayStr]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // 1. Status Filter
      if (statusFilter !== 'All' && o.status !== statusFilter) {
        return false;
      }

      // 2. Timing Filter
      if (timingFilter !== 'all') {
        const timing = getOrderTimingStatus(o, todayStr);
        if (timingFilter === 'due_today' && timing !== 'due_today') return false;
        if (timingFilter === 'upcoming' && timing !== 'upcoming') return false;
        if (timingFilter === 'overdue' && timing !== 'overdue') return false;
      }

      // 3. Search query (order number, customer name, mobile)
      const q = search.trim().toLowerCase();
      if (!q) return true;

      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.includes(q) ||
        (o.deliveryAddress && o.deliveryAddress.toLowerCase().includes(q)) ||
        o.items.some((it) => it.productName.toLowerCase().includes(q))
      );
    });
  }, [orders, statusFilter, timingFilter, search, todayStr]);

  return (
    <div className="space-y-4 select-none max-w-7xl mx-auto pb-16">
      
      {/* 1. Top Header & Action Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 flex items-center gap-2.5 font-serif">
            <ClipboardList className="w-6 h-6 text-[#B8860B]" />
            <span>Customer Orders & Advance Bookings</span>
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Accept custom sweet boxes, dry fruit hampers, advance party bookings & scheduled deliveries
          </p>
        </div>

        <button
          onClick={handleOpenAddOrder}
          className="btn-gold py-2.5 px-4 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>+ New Order</span>
        </button>
      </div>

      {/* 2. Executive KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        
        {/* Active Orders */}
        <div 
          onClick={() => { setTimingFilter('all'); setStatusFilter('All'); }}
          className={`p-3.5 rounded-2xl bg-white border cursor-pointer transition-all shadow-sm ${
            timingFilter === 'all' && statusFilter === 'All' ? 'border-[#C99A18] ring-1 ring-[#C99A18]/30' : 'border-[#E8DEC8] hover:border-stone-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Active Orders</span>
            <div className="w-7 h-7 rounded-lg bg-[#FAF8F5] border border-[#E8DEC8] text-[#B8860B] flex items-center justify-center">
              <ClipboardList className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-stone-900 mt-1">{stats.active}</div>
          <div className="text-[10px] text-stone-500 mt-1 font-medium">Pending or In-Prep</div>
        </div>

        {/* Due Today */}
        <div 
          onClick={() => setTimingFilter('due_today')}
          className={`p-3.5 rounded-2xl bg-white border cursor-pointer transition-all shadow-sm ${
            timingFilter === 'due_today' ? 'border-[#C99A18] ring-1 ring-[#C99A18]/30 bg-amber-50/20' : 'border-[#E8DEC8] hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
              <span>Due Today</span>
              {stats.dueToday > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-900 mt-1">{stats.dueToday}</div>
          <div className="text-[10px] text-amber-700 mt-1 font-medium">Deliveries scheduled today</div>
        </div>

        {/* Upcoming Deliveries */}
        <div 
          onClick={() => setTimingFilter('upcoming')}
          className={`p-3.5 rounded-2xl bg-white border cursor-pointer transition-all shadow-sm ${
            timingFilter === 'upcoming' ? 'border-[#C99A18] ring-1 ring-[#C99A18]/30 bg-blue-50/20' : 'border-[#E8DEC8] hover:border-blue-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Upcoming</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
              <CalendarClock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-blue-900 mt-1">{stats.upcoming}</div>
          <div className="text-[10px] text-blue-700 mt-1 font-medium">Scheduled for future dates</div>
        </div>

        {/* Overdue / Delayed */}
        <div 
          onClick={() => setTimingFilter('overdue')}
          className={`p-3.5 rounded-2xl bg-white border cursor-pointer transition-all shadow-sm ${
            timingFilter === 'overdue' ? 'border-rose-400 ring-1 ring-rose-300 bg-rose-50/20' : 'border-[#E8DEC8] hover:border-rose-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1">
              <span>Overdue</span>
              {stats.overdue > 0 && <AlertTriangle className="w-3 h-3 text-rose-600" />}
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-rose-900 mt-1">{stats.overdue}</div>
          <div className="text-[10px] text-rose-700 mt-1 font-medium">Needs attention / dispatch</div>
        </div>

      </div>

      {/* 3. Filter & Search Controls */}
      <div className="p-3.5 bg-white border border-[#E8DEC8] rounded-2xl shadow-sm space-y-3">
        
        {/* Top: Search and Timing Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          
          {/* Timing Tabs */}
          <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-[#E8DEC8] overflow-x-auto no-scrollbar shrink-0">
            {[
              ['all', 'All Dates'],
              ['due_today', 'Due Today'],
              ['upcoming', 'Upcoming'],
              ['overdue', 'Overdue'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTimingFilter(key as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  timingFilter === key
                    ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Order #, Name, Mobile..."
              style={{ paddingLeft: '34px' }}
              className="w-full pr-8 py-2 text-xs bg-white border border-[#E8DEC8] rounded-xl text-stone-900 placeholder:text-stone-400 focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-[#F0EBE0]">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mr-1 shrink-0">
            Status:
          </span>
          {['All', 'Pending', 'Confirmed', 'Preparing', 'Ready for Delivery', 'Delivered', 'Cancelled'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                statusFilter === st
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-xs font-bold'
                  : 'bg-[#FAF8F5] text-stone-600 hover:text-stone-900 border border-[#E8DEC8]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

      </div>

      {/* 4. Orders List Table / Cards */}
      <div className="bg-white border border-[#E8DEC8] rounded-2xl shadow-sm overflow-hidden">
        
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-[#FAF8F5] border border-[#E8DEC8] flex items-center justify-center text-stone-400 mb-3">
              <ClipboardList className="w-6 h-6 stroke-1" />
            </div>
            <h3 className="text-sm font-bold text-stone-800">No Orders Found</h3>
            <p className="text-xs text-stone-500 mt-1 max-w-sm">
              {orders.length === 0 
                ? 'No customer orders placed yet. Click "+ New Order" to book advance deliveries.'
                : 'No orders match your selected filters. Try clearing the search or changing status.'}
            </p>
            {orders.length === 0 && (
              <button
                onClick={handleOpenAddOrder}
                className="btn-gold text-xs py-2 px-3.5 font-bold rounded-xl mt-4"
              >
                Create First Order
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-[#FAF8F5] text-[10px] font-bold text-stone-500 uppercase tracking-wider border-b border-[#E8DEC8]">
                <tr>
                  <th className="py-3 px-4">Order Details</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Items Summary</th>
                  <th className="py-3 px-4">Delivery Schedule</th>
                  <th className="py-3 px-4 text-right">Order Total</th>
                  <th className="py-3 px-4 text-right">Advance / Balance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EBE0]">
                {filteredOrders.map((order) => {
                  const timing = getOrderTimingStatus(order, todayStr);
                  const statusConf = ORDER_STATUS_CONFIG[order.status] || ORDER_STATUS_CONFIG['Pending'];

                  return (
                    <tr 
                      key={order.id} 
                      className={`hover:bg-[#FAF8F5]/80 transition-colors ${
                        timing === 'overdue' ? 'bg-rose-50/30' : timing === 'due_today' ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      {/* Order Number & Date */}
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-stone-900 flex items-center gap-1.5">
                          <span>{order.orderNumber}</span>
                          {timing === 'due_today' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500 text-white">
                              TODAY
                            </span>
                          )}
                          {timing === 'overdue' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-600 text-white">
                              OVERDUE
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-stone-400 font-sans mt-0.5">
                          Booked: {order.orderDate}
                        </div>
                      </td>

                      {/* Customer Name & Phone */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-stone-900">{order.customerName}</div>
                        <div className="text-[10px] text-stone-500 font-mono flex items-center gap-1 mt-0.5">
                          <Phone className="w-2.5 h-2.5 text-stone-400" />
                          <span>{order.customerPhone}</span>
                        </div>
                      </td>

                      {/* Items Summary */}
                      <td className="py-3 px-4 max-w-xs truncate" title={formatOrderItemsSummary(order.items)}>
                        <div className="font-medium text-stone-800 truncate">
                          {formatOrderItemsSummary(order.items)}
                        </div>
                        <div className="text-[10px] text-stone-400">
                          {order.items.length} item{order.items.length === 1 ? '' : 's'} total
                        </div>
                      </td>

                      {/* Delivery Schedule */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-stone-900 flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3 text-[#B8860B]" />
                          <span>{order.deliveryDate}</span>
                        </div>
                        {order.deliveryTime && (
                          <div className="text-[10px] text-stone-500 flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5 text-stone-400" />
                            <span>{order.deliveryTime}</span>
                          </div>
                        )}
                      </td>

                      {/* Order Total */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-stone-900">
                        Rs. {order.totalAmount.toFixed(2)}
                      </td>

                      {/* Advance & Balance */}
                      <td className="py-3 px-4 text-right font-mono">
                        <div className="text-[11px] text-emerald-700 font-bold">
                          Adv: Rs. {order.advancePaid.toFixed(2)}
                        </div>
                        <div className={`text-[11px] font-bold ${order.balanceDue > 0 ? 'text-amber-800' : 'text-stone-400'}`}>
                          Due: Rs. {order.balanceDue.toFixed(2)}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusConf.badgeBg} ${statusConf.badgeText} ${statusConf.badgeBorder}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dotColor}`} />
                          <span>{order.status}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          
                          {/* View details */}
                          <button
                            onClick={() => setSelectedOrderForView(order)}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-[#FAF8F5] border border-transparent hover:border-[#E8DEC8] transition-colors"
                            title="View order details and slip"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit order */}
                          {order.status !== 'Delivered' && order.status !== 'Cancelled' && (
                            <button
                              onClick={() => handleOpenEditOrder(order)}
                              className="p-1.5 rounded-lg text-stone-500 hover:text-amber-700 hover:bg-amber-50/50 border border-transparent hover:border-amber-200 transition-colors"
                              title="Edit order"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Cancel order */}
                          {order.status !== 'Cancelled' && (
                            <button
                              onClick={async () => {
                                if (window.confirm(`Are you sure you want to cancel order ${order.orderNumber}?`)) {
                                  await onUpdateOrderStatus(order.id, 'Cancelled');
                                }
                              }}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                              title="Cancel order"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* 5. Create / Edit Order Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-[#E8DEC8] rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[#E8DEC8] bg-[#FAF8F5] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-stone-900 font-serif">
                  {editingOrder ? `Edit Order — ${editingOrder.orderNumber}` : 'Create New Customer Order'}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Book customer advance order for sweets, namkeen, or gift boxes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-white border border-transparent hover:border-[#E8DEC8] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitOrder} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
              
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Customer Info Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Customer Name <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                    className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 focus:bg-white focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Mobile Number <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 focus:bg-white focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Delivery Schedule Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Order Date
                  </label>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 focus:bg-white focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Delivery Date <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#C99A18] rounded-xl text-stone-900 focus:ring-1 focus:ring-[#C99A18] focus:outline-none font-mono font-bold shadow-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Delivery Time Slot
                  </label>
                  <select
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 focus:bg-white focus:border-[#C99A18] focus:outline-none"
                  >
                    <option value="Morning (9 AM - 12 PM)">Morning (9 AM - 12 PM)</option>
                    <option value="Afternoon (12 PM - 4 PM)">Afternoon (12 PM - 4 PM)</option>
                    <option value="Evening (5 PM - 8 PM)">Evening (5 PM - 8 PM)</option>
                    <option value="Night (8 PM - 10 PM)">Night (8 PM - 10 PM)</option>
                    <option value="Anytime during day">Anytime during day</option>
                  </select>
                </div>
              </div>

              {/* Delivery Address */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Delivery Address / Venue (Optional)
                </label>
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Enter delivery address or venue (optional)"
                  className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 focus:bg-white focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none"
                />
              </div>

              {/* Order Items Section */}
              <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DEC8] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-[#B8860B]" />
                    <span>Order Items ({orderItems.length})</span>
                  </h4>
                  <span className="text-[10px] text-stone-500">Pick from existing products</span>
                </div>

                {/* Add Item Row with Searchable Combobox */}
                <div className="grid grid-cols-12 gap-2 bg-white p-2.5 rounded-xl border border-[#E8DEC8]">
                  <div className="col-span-12 sm:col-span-5 relative" ref={productPickerRef}>
                    <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">
                      Product <span className="text-[#A67D0C] font-normal normal-case">(Type to search)</span>
                    </label>

                    {selectedProductObj ? (
                      <div className="flex items-center justify-between w-full px-2.5 py-1.5 text-xs bg-amber-50/80 border border-[#D4AF37] rounded-lg text-stone-900 shadow-xs">
                        <div className="truncate pr-1">
                          <span className="font-bold text-stone-900">{selectedProductObj.name}</span>
                          <span className="text-[10px] text-stone-500 ml-1">({selectedProductObj.unit}) · Rs. {selectedProductObj.sellingPrice}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProductId('');
                            setItemPrice(0);
                            setProductSearchQuery('');
                            setIsProductDropdownOpen(true);
                          }}
                          className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-amber-100 transition-colors shrink-0"
                          title="Change product"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                        <input
                          type="text"
                          value={productSearchQuery}
                          onChange={(e) => {
                            setProductSearchQuery(e.target.value);
                            setIsProductDropdownOpen(true);
                          }}
                          onFocus={() => setIsProductDropdownOpen(true)}
                          placeholder="Search item, SKU or barcode..."
                          className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-lg text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none"
                        />
                        {productSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setProductSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Searchable Dropdown Popup */}
                    {isProductDropdownOpen && !selectedProductObj && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-[#E8DEC8] rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                        {pickerFilteredProducts.length === 0 ? (
                          <div className="p-3 text-center text-xs text-stone-400">
                            No matching products found
                          </div>
                        ) : (
                          <div className="py-1 divide-y divide-stone-100">
                            {pickerFilteredProducts.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => handleProductSelect(p.id)}
                                className="w-full px-3 py-2 text-left hover:bg-amber-50/70 flex items-center justify-between gap-2 transition-colors group cursor-pointer"
                              >
                                <div className="min-w-0">
                                  <div className="font-bold text-xs text-stone-900 group-hover:text-[#A67D0C] truncate">
                                    {p.name}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px] text-stone-500 mt-0.5">
                                    <span className="font-mono text-stone-600 font-semibold">{p.sku}</span>
                                    <span>·</span>
                                    <span className="bg-stone-100 text-stone-600 px-1 rounded">{p.unit}</span>
                                    {p.category && (
                                      <>
                                        <span>·</span>
                                        <span className="text-stone-400 truncate">{p.category}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="font-mono font-bold text-xs text-[#A67D0C] shrink-0">
                                  Rs. {p.sellingPrice}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="col-span-4 sm:col-span-2">
                    <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Qty</label>
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      value={itemQty}
                      onChange={(e) => setItemQty(parseFloat(e.target.value) || 1)}
                      className="w-full px-2 py-1.5 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-lg text-stone-900 font-mono text-center focus:bg-white focus:border-[#C99A18] focus:outline-none"
                    />
                  </div>

                  <div className="col-span-4 sm:col-span-2">
                    <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Price (₹)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={itemPrice}
                      onChange={(e) => setItemPrice(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-lg text-stone-900 font-mono text-center focus:bg-white focus:border-[#C99A18] focus:outline-none"
                    />
                  </div>

                  <div className="col-span-4 sm:col-span-3 flex items-end">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      disabled={!selectedProductId}
                      className="w-full py-1.5 px-3 rounded-lg bg-[#C99A18] text-white text-xs font-bold disabled:opacity-40 hover:bg-[#A67D0C] transition-colors"
                    >
                      + Add Item
                    </button>
                  </div>
                </div>

                {/* Items List */}
                {orderItems.length === 0 ? (
                  <div className="py-4 text-center text-xs text-stone-400 border border-dashed border-[#E8DEC8] rounded-xl bg-white">
                    No items added yet. Select a product above to add to this order.
                  </div>
                ) : (
                  <div className="space-y-1.5 bg-white p-2 rounded-xl border border-[#E8DEC8] max-h-48 overflow-y-auto">
                    {orderItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-[#FAF8F5] text-xs">
                        <div className="min-w-0 pr-2">
                          <span className="font-bold text-stone-900 block truncate">{item.productName}</span>
                          <span className="text-[10px] text-stone-500 font-mono">
                            {item.quantity} {item.unit} @ Rs. {item.unitPrice}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono font-bold text-stone-900">
                            Rs. {item.subtotal.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-stone-400 hover:text-rose-600 p-0.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>

              {/* Payment & Totals Section */}
              <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DEC8] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  {/* Advance Payment Input */}
                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1">
                      Advance Paid (INR)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={advancePaid}
                      onChange={(e) => setAdvancePaid(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 text-xs bg-white border border-[#E8DEC8] rounded-xl text-stone-900 font-mono font-bold focus:border-[#C99A18] focus:outline-none"
                    />
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1">
                      Advance Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-[#E8DEC8] rounded-xl text-stone-900 focus:border-[#C99A18] focus:outline-none font-semibold"
                    >
                      <option value="CASH">Cash in Drawer</option>
                      <option value="UPI">UPI / QR Code Scan</option>
                      <option value="CARD">Debit / Credit Card</option>
                      <option value="BANK_TRANSFER">Direct Bank Transfer</option>
                    </select>
                  </div>

                </div>

                {/* Status selector (for edits or manual override) */}
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Order Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CustomerOrderStatus)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E8DEC8] rounded-xl text-stone-900 focus:border-[#C99A18] focus:outline-none font-semibold"
                  >
                    <option value="Pending">Pending (Received, Awaiting Confirmation)</option>
                    <option value="Confirmed">Confirmed (Advance Received / Accepted)</option>
                    <option value="Preparing">Preparing (Kitchen / Packing in Progress)</option>
                    <option value="Ready for Delivery">Ready for Delivery (Packed & Ready)</option>
                    <option value="Delivered">Delivered (Handed over to customer)</option>
                    <option value="Cancelled">Cancelled (Void order)</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Special Notes / Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Gift box packing, less sugar, pack separately in 500g boxes"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E8DEC8] rounded-xl text-stone-900 focus:border-[#C99A18] focus:outline-none"
                  />
                </div>

                {/* Summary Strip */}
                <div className="pt-2 border-t border-[#E8DEC8] flex flex-wrap items-center justify-between text-xs font-mono font-bold text-stone-800">
                  <div>
                    <span className="text-stone-500 font-sans text-[11px]">Total:</span>{' '}
                    <span>Rs. {formCalculations.totalAmount.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 font-sans text-[11px]">Advance:</span>{' '}
                    <span className="text-emerald-700">Rs. {formCalculations.advancePaid.toFixed(2)}</span>
                  </div>
                  <div className="text-base text-[#B8860B]">
                    <span className="text-stone-500 font-sans text-xs">Balance Due:</span>{' '}
                    <span>Rs. {formCalculations.balanceDue.toFixed(2)}</span>
                  </div>
                </div>

              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E8DEC8]">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5] border border-[#E8DEC8] transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-gold py-2 px-5 rounded-xl text-xs font-bold shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingOrder ? 'Update Order' : 'Confirm & Save Order'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* 6. Order Details & Receipt Modal */}
      {selectedOrderForView && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-[#E8DEC8] rounded-2xl shadow-xl w-full max-w-lg overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#E8DEC8] bg-[#FAF8F5] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white border border-[#C99A18]/50 flex items-center justify-center text-[#B8860B] font-bold text-xs">
                  ORD
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 font-mono">
                    {selectedOrderForView.orderNumber}
                  </h3>
                  <p className="text-[10px] text-stone-500">
                    Booked on {selectedOrderForView.orderDate}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedOrderForView(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Slip Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar text-xs">
              
              {/* Customer Box */}
              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900 text-sm">{selectedOrderForView.customerName}</span>
                  <a
                    href={`tel:${selectedOrderForView.customerPhone}`}
                    className="font-mono text-stone-600 hover:text-[#B8860B] flex items-center gap-1 text-[11px]"
                  >
                    <Phone className="w-3 h-3" />
                    <span>{selectedOrderForView.customerPhone}</span>
                  </a>
                </div>
                {selectedOrderForView.deliveryAddress && (
                  <div className="text-[11px] text-stone-600 flex items-start gap-1 pt-1 border-t border-[#E8DEC8]">
                    <MapPin className="w-3 h-3 text-[#B8860B] shrink-0 mt-0.5" />
                    <span>{selectedOrderForView.deliveryAddress}</span>
                  </div>
                )}
              </div>

              {/* Delivery Schedule Banner */}
              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                    Scheduled Delivery
                  </span>
                  <span className="text-xs font-bold font-mono text-stone-900">
                    {selectedOrderForView.deliveryDate}
                  </span>
                  {selectedOrderForView.deliveryTime && (
                    <span className="text-[11px] text-stone-600 ml-1.5 font-sans">
                      ({selectedOrderForView.deliveryTime})
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                    Status
                  </span>
                  <span className="text-xs font-bold text-amber-900">
                    {selectedOrderForView.status}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-[#E8DEC8] rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] text-[10px] font-bold text-stone-500 uppercase border-b border-[#E8DEC8]">
                    <tr>
                      <th className="py-2 px-3">Item</th>
                      <th className="py-2 px-3 text-center">Qty</th>
                      <th className="py-2 px-3 text-right">Rate</th>
                      <th className="py-2 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0EBE0]">
                    {selectedOrderForView.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-medium text-stone-900">{it.productName}</td>
                        <td className="py-2 px-3 text-center font-mono text-stone-600">
                          {it.quantity} {it.unit}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-stone-600">
                          Rs. {it.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-stone-900">
                          Rs. {it.subtotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Payment Summary */}
              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] space-y-1.5 font-mono text-xs">
                <div className="flex justify-between text-stone-600">
                  <span>Subtotal:</span>
                  <span>Rs. {selectedOrderForView.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-stone-900 text-sm pt-1 border-t border-[#E8DEC8]">
                  <span>Order Total:</span>
                  <span>Rs. {selectedOrderForView.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Advance Received ({selectedOrderForView.paymentMethod || 'CASH'}):</span>
                  <span>Rs. {selectedOrderForView.advancePaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#B8860B] font-bold text-sm pt-1 border-t border-[#E8DEC8]">
                  <span>Balance Due on Delivery:</span>
                  <span>Rs. {selectedOrderForView.balanceDue.toFixed(2)}</span>
                </div>
              </div>

              {/* Special Notes */}
              {selectedOrderForView.notes && (
                <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-700 text-xs">
                  <span className="font-bold text-[10px] uppercase text-stone-500 block mb-0.5">Instructions:</span>
                  <span>{selectedOrderForView.notes}</span>
                </div>
              )}

              {/* Quick Status Changer */}
              <div className="pt-2 border-t border-[#E8DEC8]">
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block mb-1">
                  Update Order Status
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Confirmed', 'Preparing', 'Ready for Delivery', 'Delivered', 'Cancelled'] as CustomerOrderStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={async () => {
                        await onUpdateOrderStatus(selectedOrderForView.id, st);
                        setSelectedOrderForView({ ...selectedOrderForView, status: st });
                      }}
                      className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                        selectedOrderForView.status === st
                          ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white border-[#B8860B] shadow-xs'
                          : 'bg-white text-stone-600 border-[#E8DEC8] hover:bg-stone-50'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Footer Actions */}
            <div className="px-5 py-3 border-t border-[#E8DEC8] bg-[#FAF8F5] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const phone = normalizeWhatsAppPhoneNumber(selectedOrderForView.customerPhone);
                  if (phone) {
                    const text = encodeURIComponent(generateWhatsAppOrderMessage(selectedOrderForView));
                    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
                  } else {
                    alert('Invalid phone number for WhatsApp');
                  }
                }}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>WhatsApp Slip</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="px-3 py-2 rounded-xl bg-white text-stone-700 hover:text-stone-900 border border-[#E8DEC8] text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5 text-stone-500" />
                  <span>Print Slip</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedOrderForView(null)}
                  className="px-4 py-2 rounded-xl bg-stone-700 text-white text-xs font-bold hover:bg-stone-800"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
