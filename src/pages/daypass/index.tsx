import Alert from "@/components/ui/alert";
import {
  getDayPassMembers,
  registerDayPassMember,
} from "@/services/day-pass-api";
import { getMembershipPlans } from "@/services/membership-plans-api";
import { CreditCard, Loader2, Plus, Search, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

export default function Daypass() {
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setisLoading] = useState(false);
  const [isNewDayPassOpen, setIsNewDayPassOpen] = useState(false);
  const [Error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [membershipPlans, setMembershipPlans] = useState<any[]>([]); // Replace with actual membership plan type
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [pageAlert, setPageAlert] = useState<{
    visible: boolean;
    variant?: "success" | "error" | "warning" | "info";
    title?: string;
    description?: string;
  }>({ visible: false });
  const [plansError, setPlansError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    membershipPlan: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [pageItems, setPageItems] = useState<any[]>([]); // Replace with actual day pass member type

  const navigate = useNavigate();

  const dayendData = localStorage.getItem("dayEndData")
    ? JSON.parse(localStorage.getItem("dayEndData") as string)
    : null;

  useEffect(() => {
    if (!dayendData) {
      navigate("/dayend");
    }
  }, [dayendData]);

  const start = (page - 1) * pageSize;
  const total = 0; // Replace with actual total from API
  const totalPages = Math.ceil(total / pageSize);

  const validateForm = () => {
    const errors: FieldErrors = {};

    // Name
    if (!form.name.trim()) {
      errors.name = "Name is required";
    } else if (form.name.trim().length < 3) {
      errors.name = "Name must be at least 3 characters";
    }

    // Phone
    if (!form.phone.trim()) {
      errors.phone = "Phone number is required";
    } else if (!/^\d{9}$/.test(form.phone)) {
      errors.phone = "Enter a valid 9-digit mobile number";
    }

    // Membership Plan
    if (!form.membershipPlan) {
      errors.membershipPlan = "Please select a membership plan";
    }

    // Payment Method
    if (!paymentMethod) {
      errors.paymentMethod = "Please select a payment method";
    }

    setFieldErrors(errors);

    return Object.keys(errors).length === 0;
  };
  type MembershipPlan = {
    id: string;
    title: string;
    price: number;
  };

  const handleGetDayPasses = async () => {
    setisLoading(true);
    setError(null);
    try {
      const res = await getDayPassMembers();
      setPageItems(res);
    } catch (error) {
      setError("Failed to load day passes. Please try again later.");
    }
    setisLoading(false);
  };

  useEffect(() => {
    handleGetDayPasses();
  }, [page, pageSize, searchTerm]);

  const handleDayPassRegistration = async () => {
    if (!validateForm()) {
      return;
    }

    setIsRegistering(true);

    const body = {
      name: form.name,
      mobileNumber: form.phone,
      membershipPlanId: form.membershipPlan,
      amount:
        membershipPlans.find((p) => p.id === form.membershipPlan)?.price ?? 0,
      paymentType: paymentMethod === "cash" ? 1 : 2,
      paymentStatus: 2,
    };

    try {
      const response = await registerDayPassMember(body);
      setPageAlert({
        visible: true,
        variant: "success",
        title: "Day Pass Registered",
        description: `Day pass for ${response.name} has been successfully registered.`,
      });
      setForm({ name: "", phone: "", membershipPlan: "" });
      setFieldErrors({});
      closeNewDayPassModal();
      handleGetDayPasses();
    } catch (error) {
      setPageAlert({
        visible: true,
        variant: "error",
        title: "Registration Failed",
        description: "Failed to register day pass. Please try again.",
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const updateField = (field: keyof Form, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  };

  const fetchMembershipPlans = async () => {
    setIsLoadingPlans(true);
    try {
      const response = await getMembershipPlans();
      const plans =
        response?.additionalData?.response ??
        response?.response ??
        response ??
        [];

      const mappedPlans: MembershipPlan[] = Array.isArray(plans)
        ? plans.map((plan: any) => ({
            id: String(plan.id),
            title: String(plan.title ?? "Unnamed Plan"),
            price: Number(plan.price ?? 0),
          }))
        : [];

      setMembershipPlans(mappedPlans);
      setPlansError("");

      setForm((current) => {
        if (current.membershipPlan || mappedPlans.length === 0) {
          return current;
        }

        return { ...current, membershipPlan: mappedPlans[0].id };
      });
    } catch (error) {
      setPlansError("Failed to load membership plans. Please try again later.");
      setMembershipPlans([]);
    } finally {
      setIsLoadingPlans(false);
    }
  };

  useEffect(() => {
    fetchMembershipPlans();
  }, []);

  type Form = {
    name: string;
    phone: string;
    membershipPlan: string;
  };

  type FieldErrors = {
    name?: string;
    phone?: string;
    membershipPlan?: string;
    paymentMethod?: string;
  };

  const openNewDaypassModal = () => {
    setIsNewDayPassOpen(true);
  };

  const closeNewDayPassModal = () => {
    setIsNewDayPassOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {pageAlert.visible && (
        <div>
          <Alert
            variant={pageAlert.variant as any}
            title={pageAlert.title}
            description={pageAlert.description}
            onClose={() => setPageAlert((s) => ({ ...s, visible: false }))}
          />
        </div>
      )}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
                Daypass Registration
              </h1>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
                Today
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Search for returning members or register a new one
            </p>
          </div>
          <div className="w-full max-w-md">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-md px-3 py-2 text-sm shadow-sm">
              <Search size={16} className="text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full outline-none text-sm"
                placeholder="Search by name, phone or status..."
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openNewDaypassModal}
              className="flex items-center gap-2 px-3 py-2.5 bg-primary text-white rounded cursor-pointer bg-blue-700 transition text-sm"
            >
              <Plus size={14} />
              New Daypass
            </button>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3">
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-600 border-b border-gray-100">
                    <th className="py-2 px-3">MEMBER</th>
                    <th className="py-2 px-3">PHONE</th>
                    <th className="py-2 px-3">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8">
                        <div className="flex items-center justify-center gap-3">
                          <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                          <span className="text-sm text-gray-600">
                            Loading day passes...
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : Error ? (
                    <tr>
                      <td colSpan={6} className="py-8">
                        <div className="flex items-center justify-center">
                          <span className="text-sm text-red-600">{Error}</span>
                        </div>
                      </td>
                    </tr>
                  ) : pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8">
                        <div className="flex items-center justify-center">
                          <span className="text-sm text-gray-500">
                            No day passes found
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-2 px-3 align-top">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-semibold">
                              {p.name
                                .split(" ")
                                .map((n: string) => n[0])
                                .slice(0, 2)
                                .join("")}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {p.name}
                              </div>
                              <div className="text-xs text-blue-600">
                                {p.pid}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 align-top text-gray-700">
                          {p.mobileNumber}
                        </td>
                        <td className="py-2 px-3 align-top">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              p.paymentStatus === "Paid"
                                ? "bg-emerald-100 text-emerald-700"
                                : p.paymentStatus === "Unpaid"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {p.paymentStatus === "Paid"
                              ? "Paid"
                              : p.paymentStatus === "Unpaid"
                                ? "Unpaid"
                                : "Overdue"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-gray-100 bg-white flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {total === 0 ? 0 : start + 1} to{" "}
              {Math.min(start + pageSize, total)} of {total} entries
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600">Rows:</label>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="border rounded-md px-2 py-1 text-sm"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                </select>
              </div>
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded-md border bg-white text-sm disabled:opacity-50"
              >
                Prev
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i + 1)}
                    className={`px-2 py-1 text-sm rounded-md ${page === i + 1 ? "bg-gray-900 text-white" : "bg-white border"}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded-md border bg-white text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
        {isNewDayPassOpen &&
          createPortal(
            <div className="fixed inset-0 z-80 flex items-center justify-center bg-black/50 px-3 py-4 sm:px-4 sm:py-6">
              <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">
                      Register New Day Pass
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Complete all steps to register the day pass in the system.
                    </p>
                  </div>
                  <button
                    onClick={closeNewDayPassModal}
                    className="rounded-full cursor-pointer p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="max-h-[calc(92vh-160px)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                        <UserRound size={20} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 sm:text-md">
                          Personal Details
                        </h3>
                        <p className="text-sm text-gray-500">
                          Basic identification information
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 lg:gap-4">
                      <div>
                        <label className="mb-2 block text-xs font-medium text-gray-900 sm:text-sm">
                          Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={form.name}
                          onChange={(e) => updateField("name", e.target.value)}
                          className={`w-full rounded-lg px-4 py-2.5 text-sm outline-none transition
    ${
      fieldErrors.name
        ? "border border-red-500"
        : "border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
    }`}
                        />

                        {fieldErrors.name && (
                          <p className="mt-1 text-xs text-red-600">
                            {fieldErrors.name}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-medium text-gray-900 sm:text-sm">
                          Phone No <span className="text-red-500">*</span>
                        </label>
                        <div
                          className={`flex overflow-hidden rounded-lg
    ${
      fieldErrors.phone
        ? "border border-red-500"
        : "border border-gray-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100"
    }`}
                        >
                          <span className="border-r border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-500">
                            +94
                          </span>
                          <input
                            value={form.phone}
                            onChange={(event) =>
                              updateField("phone", event.target.value)
                            }
                            inputMode="numeric"
                            maxLength={9}
                            className="w-full px-4 py-2.5 text-sm outline-none"
                            placeholder="712 345 678"
                          />
                        </div>
                        {fieldErrors.phone && (
                          <p className="mt-2 text-[11px] text-red-600 sm:text-xs">
                            {fieldErrors.phone}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-medium text-gray-900 sm:text-sm">
                          Membership Plan{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={form.membershipPlan}
                          onChange={(e) =>
                            updateField("membershipPlan", e.target.value)
                          }
                          className={`w-full rounded-lg px-4 py-2.5 text-sm outline-none
    ${
      fieldErrors.membershipPlan
        ? "border border-red-500"
        : "border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
    }`}
                        >
                          <option value="">
                            {isLoadingPlans
                              ? "Loading plans..."
                              : "Select a plan"}
                          </option>
                          {membershipPlans
                            .filter((plan) => plan.title === "Day Pass")
                            .map((plan) => (
                              <option key={plan.id} value={plan.id}>
                                {plan.title} - LKR {plan.price.toLocaleString()}
                              </option>
                            ))}
                        </select>
                        {plansError ? (
                          <p className="mt-2 text-[11px] text-red-600 sm:text-xs">
                            {plansError}
                          </p>
                        ) : null}
                        {fieldErrors.membershipPlan && (
                          <p className="mt-1 text-xs text-red-600">
                            {fieldErrors.membershipPlan}
                          </p>
                        )}
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 md:col-span-2">
                        <label className="mb-3 block text-sm font-medium text-gray-900">
                          Payment Type
                          <span className="text-red-500 ml-1">*</span>
                        </label>

                        <div className="flex flex-wrap gap-4">
                          <label
                            className={`inline-flex items-center cursor-pointer gap-2 rounded-lg border px-4 py-3 text-sm transition
                                                        ${
                                                          paymentMethod ===
                                                          "cash"
                                                            ? "border-blue-500 bg-blue-50 text-blue-700"
                                                            : "border-gray-200 bg-white text-gray-700"
                                                        }`}
                          >
                            <input
                              type="radio"
                              name="regPaymentMethod"
                              value="cash"
                              checked={paymentMethod === "cash"}
                              onChange={() => setPaymentMethod("cash")}
                            />
                            Cash
                          </label>

                          <label
                            className={`inline-flex items-center cursor-pointer gap-2 rounded-lg border px-4 py-3 text-sm transition
                                                        ${
                                                          paymentMethod ===
                                                          "card"
                                                            ? "border-blue-500 bg-blue-50 text-blue-700"
                                                            : "border-gray-200 bg-white text-gray-700"
                                                        }`}
                          >
                            <input
                              type="radio"
                              name="regPaymentMethod"
                              value="card"
                              checked={paymentMethod === "card"}
                              onChange={() => setPaymentMethod("card")}
                            />
                            Card
                          </label>
                          {fieldErrors.paymentMethod && (
                            <p className="mt-2 text-xs text-red-600">
                              {fieldErrors.paymentMethod}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4 mb-5.5">
                      <button
                        onClick={closeNewDayPassModal}
                        className="rounded-lg cursor-pointer border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDayPassRegistration}
                        disabled={isRegistering}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
                      >
                        {isRegistering ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CreditCard size={16} />
                            Pay & Register
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )}
      </div>
    </div>
  );
}
