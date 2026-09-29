"use client";

import { queryKeys, useWorkspace } from "@/components/providers/workspace-provider";
import { BackendError } from "@/lib/api/backend";
import { useRealtime } from "@/components/realtime/realtime";
import {
	api,
	type CheckoutInput,
	type CustomerInput,
	type ExpenseFilters,
	type ExpenseInput,
	type KitchenBoardDto,
	type KitchenStatus,
	type KitchenTicketDto,
	type ModifierGroupInput,
	type NotificationKind,
	type PlanCode,
	type NotificationListDto,
	type ProductInput,
	type ReportRange,
	type StockAdjustmentFilters,
	type StockAdjustmentInput,
} from "@/lib/api/posly";
import type { MemberRole, OrderStatus, PaymentMethod } from "@posly/types/domain";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Server state for the open shop. Every key starts with `["business", id]`, so switching
 * shops can never serve one shop's cache to another, and a mutation can invalidate
 * everything under its shop in one call.
 */

const useBusinessId = () => useWorkspace().business.id;

export function useCategories() {
	const id = useBusinessId();
	return useQuery({
		queryKey: queryKeys.categories(id),
		queryFn: ({ signal }) => api.catalog.categories(id, signal),
	});
}

export function useProducts() {
	const id = useBusinessId();
	return useQuery({
		queryKey: queryKeys.products(id),
		queryFn: ({ signal }) => api.catalog.products(id, signal),
		// The POS menu: fresh enough, and usable from cache when the network blips.
		staleTime: 30_000,
	});
}

export function useProduct(productId: string | undefined) {
	const id = useBusinessId();
	return useQuery({
		queryKey: queryKeys.product(id, productId ?? "new"),
		queryFn: ({ signal }) => api.catalog.product(id, productId as string, signal),
		enabled: Boolean(productId),
	});
}

export interface OrderFilters {
	status?: OrderStatus;
	method?: PaymentMethod;
	from?: string;
	to?: string;
	search?: string;
	page?: number;
	limit?: number;
}

export const ORDERS_PAGE_SIZE = 25;

export function useOrders(filters: OrderFilters) {
	const id = useBusinessId();
	return useQuery({
		queryKey: queryKeys.orders(id, filters),
		queryFn: ({ signal }) => api.orders.list(id, { limit: ORDERS_PAGE_SIZE, ...filters }, signal),
		placeholderData: keepPreviousData,
	});
}

export function useOrder(orderId: string) {
	const id = useBusinessId();
	return useQuery({
		queryKey: queryKeys.order(id, orderId),
		queryFn: ({ signal }) => api.orders.get(id, orderId, signal),
	});
}

export function useDashboard(range: ReportRange, enabled = true) {
	const id = useBusinessId();
	return useQuery({
		enabled,
		queryKey: queryKeys.dashboard(id, range),
		queryFn: ({ signal }) => api.reports.dashboard(id, range, signal),
		placeholderData: keepPreviousData,
		refetchInterval: 60_000,
	});
}

export function useMembers() {
	const id = useBusinessId();
	return useQuery({
		queryKey: queryKeys.members(id),
		queryFn: ({ signal }) => api.members.list(id, signal),
	});
}

/** Invalidate everything a sale touches: orders, the dashboard, and stock on the menu. */
const useInvalidateSales = () => {
	const queryClient = useQueryClient();
	const id = useBusinessId();
	return () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: ["business", id, "orders"] }),
			queryClient.invalidateQueries({ queryKey: ["business", id, "order"] }),
			queryClient.invalidateQueries({ queryKey: ["business", id, "dashboard"] }),
			queryClient.invalidateQueries({ queryKey: queryKeys.products(id) }),
			// The shop detail carries this month's order count against the plan's quota.
			queryClient.invalidateQueries({ queryKey: queryKeys.business(id), exact: true }),
			queryClient.invalidateQueries({ queryKey: ["business", id, "customers"] }),
			// A sale can run stock out; a refund is news for the owner.
			queryClient.invalidateQueries({ queryKey: queryKeys.notifications(id) }),
		]);
};

export function useCheckout() {
	const id = useBusinessId();
	const invalidate = useInvalidateSales();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: CheckoutInput) => api.orders.checkout(id, input),
		onSuccess: () => void invalidate(),
		// 409 = another till took the last units first. Re-read the shelf straight away so the
		// cart marks the short line, instead of waiting for the next background refresh.
		onError: (error) => {
			if (error instanceof BackendError && error.status === 409) {
				void queryClient.invalidateQueries({ queryKey: queryKeys.products(id) });
			}
		},
	});
}

export function useReverseOrder() {
	const id = useBusinessId();
	const invalidate = useInvalidateSales();
	return useMutation({
		mutationFn: ({ orderId, kind, reason }: { orderId: string; kind: "refund" | "cancel"; reason?: string }) =>
			kind === "refund" ? api.orders.refund(id, orderId, reason) : api.orders.cancel(id, orderId, reason),
		onSuccess: () => void invalidate(),
	});
}

export function useSaveProduct(productId?: string) {
	const id = useBusinessId();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: ProductInput) =>
			productId ? api.catalog.updateProduct(id, productId, input) : api.catalog.createProduct(id, input),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.products(id) });
			void queryClient.invalidateQueries({ queryKey: queryKeys.categories(id) });
		},
	});
}

/** A manual stock change; the dashboard's low-stock list depends on it too. */
export function useAdjustStock() {
	const id = useBusinessId();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ productId, ...input }: StockAdjustmentInput & { productId: string }) =>
			api.catalog.adjustStock(id, productId, input),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.products(id) });
			void queryClient.invalidateQueries({ queryKey: ["business", id, "dashboard"] });
			void queryClient.invalidateQueries({ queryKey: ["business", id, "stock-adjustments"] });
			void queryClient.invalidateQueries({ queryKey: queryKeys.notifications(id) });
		},
	});
}

export const STOCK_HISTORY_PAGE_SIZE = 25;

export function useStockAdjustments(filters: StockAdjustmentFilters) {
	const id = useBusinessId();
	return useQuery({
		queryKey: queryKeys.stockAdjustments(id, filters),
		queryFn: ({ signal }) =>
			api.catalog.stockAdjustments(id, { limit: STOCK_HISTORY_PAGE_SIZE, ...filters }, signal),
		placeholderData: keepPreviousData,
	});
}

export const EXPENSES_PAGE_SIZE = 25;

export function useExpenses(filters: ExpenseFilters) {
	const id = useBusinessId();
	return useQuery({
		queryKey: queryKeys.expenses(id, filters),
		queryFn: ({ signal }) => api.expenses.list(id, { limit: EXPENSES_PAGE_SIZE, ...filters }, signal),
		placeholderData: keepPreviousData,
	});
}

export function useExpenseSummary(filters: Omit<ExpenseFilters, "page">) {
	const id = useBusinessId();
	return useQuery({
		queryKey: queryKeys.expenseSummary(id, filters),
		queryFn: ({ signal }) => api.expenses.summary(id, filters, signal),
		placeholderData: keepPreviousData,
	});
}

/** Expense writes; the list, its totals and the profit on the dashboard all follow. */
export function useExpenseMutations() {
	const id = useBusinessId();
	const queryClient = useQueryClient();
	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: ["business", id, "expenses"] }),
			queryClient.invalidateQueries({ queryKey: ["business", id, "dashboard"] }),
		]);
	return {
		create: useMutation({ mutationFn: (input: ExpenseInput) => api.expenses.create(id, input), onSuccess: () => void refresh() }),
		update: useMutation({
			mutationFn: ({ expenseId, ...input }: Partial<ExpenseInput> & { expenseId: string }) =>
				api.expenses.update(id, expenseId, input),
			onSuccess: () => void refresh(),
		}),
		remove: useMutation({ mutationFn: (expenseId: string) => api.expenses.remove(id, expenseId), onSuccess: () => void refresh() }),
	};
}

export const CUSTOMERS_PAGE_SIZE = 25;

export function useCustomers(query: { search?: string; page?: number; limit?: number }, enabled = true) {
	const id = useBusinessId();
	return useQuery({
		queryKey: queryKeys.customers(id, query),
		queryFn: ({ signal }) => api.customers.list(id, { limit: CUSTOMERS_PAGE_SIZE, ...query }, signal),
		placeholderData: keepPreviousData,
		enabled,
	});
}

export function useCustomerMutations() {
	const id = useBusinessId();
	const queryClient = useQueryClient();
	const refresh = () => queryClient.invalidateQueries({ queryKey: ["business", id, "customers"] });
	return {
		create: useMutation({ mutationFn: (input: CustomerInput) => api.customers.create(id, input), onSuccess: () => void refresh() }),
		update: useMutation({
			mutationFn: ({ customerId, ...input }: Partial<CustomerInput> & { customerId: string }) =>
				api.customers.update(id, customerId, input),
			onSuccess: () => void refresh(),
		}),
		remove: useMutation({ mutationFn: (customerId: string) => api.customers.remove(id, customerId), onSuccess: () => void refresh() }),
	};
}

export function useModifierGroups() {
	const id = useBusinessId();
	return useQuery({
		queryKey: queryKeys.modifierGroups(id),
		queryFn: ({ signal }) => api.catalog.modifierGroups(id, signal),
	});
}

/** Group writes also change every product that uses the group, so products are re-read. */
export function useModifierGroupMutations() {
	const id = useBusinessId();
	const queryClient = useQueryClient();
	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: queryKeys.modifierGroups(id) }),
			queryClient.invalidateQueries({ queryKey: queryKeys.products(id) }),
			queryClient.invalidateQueries({ queryKey: ["business", id, "product"] }),
		]);
	return {
		create: useMutation({
			mutationFn: (input: ModifierGroupInput) => api.catalog.createModifierGroup(id, input),
			onSuccess: () => void refresh(),
		}),
		update: useMutation({
			mutationFn: ({ groupId, ...input }: ModifierGroupInput & { groupId: string }) =>
				api.catalog.updateModifierGroup(id, groupId, input),
			onSuccess: () => void refresh(),
		}),
		remove: useMutation({
			mutationFn: (groupId: string) => api.catalog.deleteModifierGroup(id, groupId),
			onSuccess: () => void refresh(),
		}),
	};
}

export function useDeleteProduct() {
	const id = useBusinessId();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (productId: string) => api.catalog.deleteProduct(id, productId),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.products(id) });
			void queryClient.invalidateQueries({ queryKey: queryKeys.categories(id) });
		},
	});
}

export function useCategoryMutations() {
	const id = useBusinessId();
	const queryClient = useQueryClient();
	const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.categories(id) });
	return {
		create: useMutation({
			mutationFn: (input: { name: string; icon?: string }) => api.catalog.createCategory(id, input),
			onSuccess: () => void refresh(),
		}),
		// Optimistic: a switch that waits for the round trip feels broken. The cache flips at
		// once, rolls back if the API refuses, and is re-read from the server either way.
		update: useMutation({
			mutationFn: ({
				categoryId,
				...input
			}: { categoryId: string; isActive?: boolean; sendToKitchen?: boolean; name?: string }) =>
				api.catalog.updateCategory(id, categoryId, input),
			onMutate: async ({ categoryId, ...input }) => {
				const key = queryKeys.categories(id);
				await queryClient.cancelQueries({ queryKey: key });
				const previous = queryClient.getQueryData<Awaited<ReturnType<typeof api.catalog.categories>>>(key);
				queryClient.setQueryData<typeof previous>(key, (list) =>
					list?.map((c) => (c.id === categoryId ? { ...c, ...input } : c))
				);
				return { previous };
			},
			onError: (_error, _input, context) => {
				if (context?.previous) queryClient.setQueryData(queryKeys.categories(id), context.previous);
			},
			onSettled: () => void refresh(),
		}),
		reorder: useMutation({
			mutationFn: (ids: string[]) => api.catalog.reorderCategories(id, ids),
			onSuccess: (data) => queryClient.setQueryData(queryKeys.categories(id), data),
		}),
	};
}

export function useInviteMember() {
	const id = useBusinessId();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: { email: string; name: string; role: MemberRole }) => api.members.invite(id, input),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.members(id) });
			void queryClient.invalidateQueries({ queryKey: queryKeys.business(id), exact: true });
		},
	});
}

export function useRegenerateInvite() {
	const id = useBusinessId();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (memberId: string) => api.members.regenerateLink(id, memberId),
		onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.members(id) }),
	});
}

/** Role and access changes to one member; the list is re-read either way. */
export function useMemberMutations() {
	const id = useBusinessId();
	const queryClient = useQueryClient();
	// The shop detail counts staff seats against the plan.
	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: queryKeys.members(id) }),
			queryClient.invalidateQueries({ queryKey: queryKeys.business(id), exact: true }),
		]);
	return {
		update: useMutation({
			mutationFn: ({ memberId, ...input }: { memberId: string; role?: MemberRole; status?: "ACTIVE" | "DISABLED" }) =>
				api.members.update(id, memberId, input),
			onSettled: () => void refresh(),
		}),
		cancelInvite: useMutation({
			mutationFn: (memberId: string) => api.members.cancelInvite(id, memberId),
			onSettled: () => void refresh(),
		}),
		setPermissions: useMutation({
			mutationFn: ({ memberId, permissions }: { memberId: string; permissions: string[] | null }) =>
				api.members.setPermissions(id, memberId, permissions),
			onSettled: () => void refresh(),
		}),
	};
}

/** Role defaults and what can be assigned, for the permissions editor; rarely changes. */
export function useRolePermissions(enabled = true) {
	const id = useBusinessId();
	return useQuery({
		queryKey: ["business", id, "member-roles"],
		queryFn: ({ signal }) => api.members.roles(id, signal),
		staleTime: 10 * 60_000,
		enabled,
	});
}

/** The public price list; the same for every shop, so cached across them. */
export function usePlans() {
	return useQuery({
		queryKey: ["plans"],
		queryFn: ({ signal }) => api.plans.list(signal),
		staleTime: 5 * 60_000,
	});
}

export function useUpdateBusiness() {
	const id = useBusinessId();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: Parameters<typeof api.businesses.update>[1]) => api.businesses.update(id, input),
		onSuccess: (data) => {
			queryClient.setQueryData(queryKeys.business(id), data);
			void queryClient.invalidateQueries({ queryKey: queryKeys.businesses });
		},
	});
}

/**
 * The bell. Polled, because other tills and other people make the news: once a minute
 * while the tab is open, and again whenever it regains focus.
 */
export function useNotifications() {
	const id = useBusinessId();
	const live = useRealtime((s) => s.connected);
	return useQuery({
		queryKey: queryKeys.notifications(id),
		queryFn: ({ signal }) => api.notifications.list(id, signal),
		refetchInterval: live ? 5 * 60_000 : 60_000,
		refetchOnWindowFocus: true,
	});
}

/** Clears the badge at once; the server's answer follows on the next read. */
export function useMarkNotificationsRead() {
	const id = useBusinessId();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => api.notifications.markAllRead(id),
		onMutate: () => {
			queryClient.setQueryData<NotificationListDto>(queryKeys.notifications(id), (list) =>
				list ? { unread: 0, items: list.items.map((n) => ({ ...n, read: true })) } : list
			);
		},
		onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications(id) }),
	});
}

/** Which kinds this member hears about; the settings screen toggles them one by one. */
export function useNotificationPreferences() {
	const id = useBusinessId();
	return useQuery({
		queryKey: queryKeys.notificationPreferences(id),
		queryFn: ({ signal }) => api.notifications.preferences(id, signal),
	});
}

export function useUpdateNotificationPreferences() {
	const id = useBusinessId();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (muted: NotificationKind[]) => api.notifications.updatePreferences(id, muted),
		onSuccess: (data) => {
			queryClient.setQueryData(queryKeys.notificationPreferences(id), data);
			void queryClient.invalidateQueries({ queryKey: queryKeys.notifications(id) });
		},
	});
}

/**
 * Paid plans. Checkout and the portal hand the browser to Stripe; a plan change stays here
 * and re-reads the shop, whose subscription the API has already updated.
 */
export function useBilling() {
	const id = useBusinessId();
	const queryClient = useQueryClient();
	const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.business(id), exact: true });
	return {
		checkout: useMutation({
			mutationFn: (plan: PlanCode) => api.billing.checkout(id, plan),
			onSuccess: ({ url }) => window.location.assign(url),
		}),
		portal: useMutation({
			mutationFn: () => api.billing.portal(id),
			onSuccess: ({ url }) => window.location.assign(url),
		}),
		change: useMutation({
			mutationFn: (plan: PlanCode) => api.billing.change(id, plan),
			onSuccess: () => void refresh(),
		}),
		refresh,
	};
}

/** The lock screen's faces: who can take over this till, and who has a PIN. */
export function useRoster(enabled = true) {
	const id = useBusinessId();
	return useQuery({
		queryKey: ["business", id, "roster"],
		queryFn: ({ signal }) => api.members.roster(id, signal),
		enabled,
	});
}

export function usePinMutations() {
	const id = useBusinessId();
	const queryClient = useQueryClient();
	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: ["business", id, "roster"] }),
			queryClient.invalidateQueries({ queryKey: queryKeys.members(id) }),
		]);
	return {
		setMine: useMutation({
			mutationFn: ({ pin, password }: { pin: string; password?: string }) => api.members.setMyPin(id, pin, password),
			onSettled: () => void refresh(),
		}),
		clearMine: useMutation({ mutationFn: () => api.members.clearMyPin(id), onSettled: () => void refresh() }),
		setHidden: useMutation({
			mutationFn: (hidden: boolean) => api.members.setSwitchHidden(id, hidden),
			onSettled: () => void refresh(),
		}),
		clear: useMutation({
			mutationFn: (memberId: string) => api.members.clearPin(id, memberId),
			onSettled: () => void refresh(),
		}),
	};
}

/**
 * The kitchen board. Polled every few seconds — new orders must appear without anyone
 * touching the screen — and kept polling in the background, since a kitchen tablet is
 * rarely the focused window.
 */
export function useKitchenBoard(enabled = true) {
	const id = useBusinessId();
	const live = useRealtime((s) => s.connected);
	const branchId = useWorkspace().branch?.id ?? null;
	return useQuery({
		queryKey: ["business", id, "kitchen", branchId],
		queryFn: ({ signal }) => api.kitchen.board(id, branchId, signal),
		// Live events redraw the board; the poll is only a safety net while they flow.
		refetchInterval: live ? 30_000 : 4000,
		refetchIntervalInBackground: true,
		enabled,
	});
}

/** Board changes apply to the cache at once; a stale tap on a busy line must feel instant. */
export function useKitchenMutations() {
	const id = useBusinessId();
	const branchId = useWorkspace().branch?.id ?? null;
	const queryClient = useQueryClient();
	const key = ["business", id, "kitchen", branchId];
	const patch = (orderId: string, change: (t: KitchenTicketDto) => KitchenTicketDto) =>
		queryClient.setQueryData<KitchenBoardDto>(key, (board) =>
			board
				? {
						open: board.open.map((t) => (t.id === orderId ? change(t) : t)),
						recent: board.recent.map((t) => (t.id === orderId ? change(t) : t)),
					}
				: board
		);
	const settle = () => void queryClient.invalidateQueries({ queryKey: key });
	return {
		setStatus: useMutation({
			mutationFn: ({ orderId, status }: { orderId: string; status: KitchenStatus }) =>
				api.kitchen.setStatus(id, orderId, status),
			onMutate: async ({ orderId, status }) => {
				await queryClient.cancelQueries({ queryKey: key });
				patch(orderId, (t) => ({ ...t, status, updatedAt: new Date().toISOString() }));
			},
			onSettled: settle,
		}),
		setPrepared: useMutation({
			mutationFn: ({ orderId, itemId, prepared }: { orderId: string; itemId: string; prepared: boolean }) =>
				api.kitchen.setPrepared(id, orderId, itemId, prepared),
			onMutate: async ({ orderId, itemId, prepared }) => {
				await queryClient.cancelQueries({ queryKey: key });
				patch(orderId, (t) => ({
					...t,
					lines: t.lines.map((l) => (l.id === itemId ? { ...l, preparedAt: prepared ? new Date().toISOString() : null } : l)),
				}));
			},
			onSettled: settle,
		}),
	};
}
