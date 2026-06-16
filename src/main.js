//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../libs/vanilla.js/src/base/vector2.js";
import { Engine, EngineConfiguration } from "../libs/vanilla.js/src/core/engine.js";
import { Graphic } from "../libs/vanilla.js/src/core/graphic.js";
import { Scene } from "../libs/vanilla.js/src/core/scene.js";
import { ViewScaleMode } from "../libs/vanilla.js/src/core/viewmanager.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const GRID_COLUMNS = 5;
const GRID_ROWS = 5;
const EMPTY_CELL = -1;
const CORE_PART_INDEX = 0;
const CORE_COLUMN = 2;
const CORE_ROW = 2;
const ADJACENT_OFFSETS = [
	[-1, 0],
	[1, 0],
	[0, -1],
	[0, 1],
];
const ENEMY_COUNT = 5;
const NO_SELECTION = -1;
const START_GOLD = 100;
const START_LEVEL = 1;
const ENEMY_MIN_ATTACHMENTS = 3;
const ENEMY_MAX_ATTACHMENTS = 8;
const ATTACHMENT_PART_INDICES = [1, 2, 3];


//==============================================================================
// 앱 탭 식별자.
//==============================================================================
const AppTab = {
	build: 0,
	shop: 1,
	battle: 2,
	settings: 3,
};


//==============================================================================
// 부품 정의 목록. (배열 인덱스가 부품 식별자로 사용된다.)
//==============================================================================
const PartDefinitions = [
	{
		name: "코어",
		symbol: "C",
		color: "#ffd24a",
		health: 50,
		attack: 0,
		speed: 0,
		price: 0,
		maxAttachments: 8,
	},
	{
		name: "무기",
		symbol: "W",
		color: "#ff5a5a",
		health: 0,
		attack: 10,
		speed: 0,
		price: 30,
	},
	{
		name: "추진체",
		symbol: "T",
		color: "#56b6ff",
		health: 0,
		attack: 0,
		speed: 5,
		price: 20,
	},
	{
		name: "장갑",
		symbol: "A",
		color: "#9aa3b2",
		health: 20,
		attack: 0,
		speed: 0,
		price: 25,
		durability: 30,
	},
];


//==============================================================================
// 빈 그리드 생성. (코어가 중앙에 배치된 상태)
//==============================================================================
/**
 * @returns { Array<Array<number>> }
 */
function createGridWithCore() {
	const grid = System.Array(GRID_COLUMNS).fill(null).map(() => System.Array(GRID_ROWS).fill(EMPTY_CELL));
	grid[CORE_COLUMN][CORE_ROW] = CORE_PART_INDEX;
	return grid;
}


//==============================================================================
// 대상 칸이 다른 부품과 상하좌우로 인접하는지 여부 반환.
//==============================================================================
/**
 * @param { Array<Array<number>> } grid
 * @param { number } column
 * @param { number } row
 * @returns { boolean }
 */
function isAdjacentInGrid(grid, column, row) {
	for (const offset of ADJACENT_OFFSETS) {
		const nextColumn = column + offset[0];
		const nextRow = row + offset[1];
		if (nextColumn >= 0 && nextColumn < GRID_COLUMNS && nextRow >= 0 && nextRow < GRID_ROWS) {
			if (grid[nextColumn][nextRow] !== EMPTY_CELL) {
				return true;
			}
		}
	}
	return false;
}


//==============================================================================
// 모든 부품이 코어와 연결되어 있는지 여부 반환.
//==============================================================================
/**
 * @param { Array<Array<number>> } grid
 * @returns { boolean }
 */
function isAllConnectedInGrid(grid) {
	const visited = System.Array(GRID_COLUMNS).fill(null).map(() => System.Array(GRID_ROWS).fill(false));
	const stack = [];
	stack.push([CORE_COLUMN, CORE_ROW]);
	visited[CORE_COLUMN][CORE_ROW] = true;
	let visitedCount = 0;

	while (stack.length > 0) {
		const cell = stack.pop();
		const column = cell[0];
		const row = cell[1];
		++visitedCount;
		for (const offset of ADJACENT_OFFSETS) {
			const nextColumn = column + offset[0];
			const nextRow = row + offset[1];
			if (nextColumn >= 0 && nextColumn < GRID_COLUMNS && nextRow >= 0 && nextRow < GRID_ROWS) {
				if (grid[nextColumn][nextRow] !== EMPTY_CELL && !visited[nextColumn][nextRow]) {
					visited[nextColumn][nextRow] = true;
					stack.push([nextColumn, nextRow]);
				}
			}
		}
	}

	let totalParts = 0;
	for (let column = 0; column < GRID_COLUMNS; ++column) {
		for (let row = 0; row < GRID_ROWS; ++row) {
			if (grid[column][row] !== EMPTY_CELL) {
				++totalParts;
			}
		}
	}
	return visitedCount === totalParts;
}


//==============================================================================
// 그리드의 합산 스탯 계산.
//==============================================================================
/**
 * @param { Array<Array<number>> } grid
 * @returns { object }
 */
function calculateStatsForGrid(grid) {
	let totalHealth = 0;
	let totalAttack = 0;
	let totalSpeed = 0;

	for (let column = 0; column < GRID_COLUMNS; ++column) {
		for (let row = 0; row < GRID_ROWS; ++row) {
			const partIndex = grid[column][row];
			if (partIndex !== EMPTY_CELL) {
				const partDefinition = PartDefinitions[partIndex];
				totalHealth += partDefinition.health;
				totalAttack += partDefinition.attack;
				totalSpeed += partDefinition.speed;
			}
		}
	}

	return {
		health: totalHealth,
		attack: totalAttack,
		speed: totalSpeed,
	};
}


//==============================================================================
// 무작위 적 우주선 그리드 생성. (코어 중심으로 인접 칸에만 부착 → 연결성 보장)
//==============================================================================
/**
 * @returns { Array<Array<number>> }
 */
function createRandomEnemyGrid() {
	const grid = createGridWithCore();
	const attachmentRange = ENEMY_MAX_ATTACHMENTS - ENEMY_MIN_ATTACHMENTS + 1;
	const attachmentTarget = ENEMY_MIN_ATTACHMENTS + System.Math.floor(System.Math.random() * attachmentRange);

	for (let placed = 0; placed < attachmentTarget; ++placed) {
		const candidates = [];
		for (let column = 0; column < GRID_COLUMNS; ++column) {
			for (let row = 0; row < GRID_ROWS; ++row) {
				if (grid[column][row] === EMPTY_CELL && isAdjacentInGrid(grid, column, row)) {
					candidates.push([column, row]);
				}
			}
		}
		if (candidates.length === 0) {
			break;
		}

		const pickedCandidate = candidates[System.Math.floor(System.Math.random() * candidates.length)];
		const partIndex = ATTACHMENT_PART_INDICES[System.Math.floor(System.Math.random() * ATTACHMENT_PART_INDICES.length)];
		grid[pickedCandidate[0]][pickedCandidate[1]] = partIndex;
	}
	return grid;
}


//==============================================================================
// 메인 앱 씬. (상단 바 + 하단 네비게이션으로 조립/상점/전투/설정 탭 전환)
//==============================================================================
class AppScene extends Scene {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { number } */ #currentTab;
	/** @type { number } */ #playerLevel;
	/** @type { number } */ #playerGold;
	/** @type { object } */ #inventory;
	/** @type { Array<Array<number>> } */ #grid;
	/** @type { number } */ #selectedPartIndex;
	/** @type { Array<object> } */ #enemyList;
	/** @type { number } */ #selectedEnemyIndex;

	//==============================================================================
	// 불러오기.
	//==============================================================================
	/**
	 * @override
	 * @param { Engine } engine
	 */
	async load(engine) {
		await super.load(engine);

		const viewManager = engine.getViewManager();
		viewManager.setViewScaleMode(ViewScaleMode.stretchHeight);

		this.reset();
	}

	//==============================================================================
	// 재시작.
	//==============================================================================
	reset() {
		this.#currentTab = AppTab.build;
		this.#playerLevel = START_LEVEL;
		this.#playerGold = START_GOLD;
		this.#inventory = {
			1: 2,
			2: 2,
			3: 2,
		};
		this.#grid = createGridWithCore();
		this.#selectedPartIndex = 1;
		this.#enemyList = this.generateRandomEnemies(ENEMY_COUNT);
		this.#selectedEnemyIndex = NO_SELECTION;
	}

	//==============================================================================
	// 현재 탭 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getCurrentTab() {
		return this.#currentTab;
	}

	//==============================================================================
	// 내 레벨 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getPlayerLevel() {
		return this.#playerLevel;
	}

	//==============================================================================
	// 내 골드 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getPlayerGold() {
		return this.#playerGold;
	}

	//==============================================================================
	// 인벤토리 반환.
	//==============================================================================
	/**
	 * @returns { object }
	 */
	getInventory() {
		return this.#inventory;
	}

	//==============================================================================
	// 특정 부품의 보유 수량 반환.
	//==============================================================================
	/**
	 * @param { number } partIndex
	 * @returns { number }
	 */
	getInventoryCount(partIndex) {
		const inventory = this.getInventory();
		return inventory[partIndex];
	}

	//==============================================================================
	// 그리드 반환.
	//==============================================================================
	/**
	 * @returns { Array<Array<number>> }
	 */
	getGrid() {
		return this.#grid;
	}

	//==============================================================================
	// 선택된 부품 인덱스 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getSelectedPartIndex() {
		return this.#selectedPartIndex;
	}

	//==============================================================================
	// 적 목록 반환.
	//==============================================================================
	/**
	 * @returns { Array<object> }
	 */
	getEnemyList() {
		return this.#enemyList;
	}

	//==============================================================================
	// 선택된 적 인덱스 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getSelectedEnemyIndex() {
		return this.#selectedEnemyIndex;
	}

	//==============================================================================
	// 무작위 적 우주선 목록 생성.
	//==============================================================================
	/**
	 * @param { number } count
	 * @returns { Array<object> }
	 */
	generateRandomEnemies(count) {
		const enemies = [];
		for (let index = 0; index < count; ++index) {
			const enemyGrid = createRandomEnemyGrid();
			const enemyStats = calculateStatsForGrid(enemyGrid);
			enemies.push({
				name: `적 우주선 ${index + 1}`,
				grid: enemyGrid,
				stats: enemyStats,
			});
		}
		return enemies;
	}

	//==============================================================================
	// 코어가 허용하는 최대 부착물 수 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getMaxAttachments() {
		const coreDefinition = PartDefinitions[CORE_PART_INDEX];
		return coreDefinition.maxAttachments;
	}

	//==============================================================================
	// 현재 부착물 수 반환. (코어 제외)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	countAttachments() {
		const grid = this.getGrid();
		let count = 0;
		for (let column = 0; column < GRID_COLUMNS; ++column) {
			for (let row = 0; row < GRID_ROWS; ++row) {
				if (grid[column][row] !== EMPTY_CELL) {
					++count;
				}
			}
		}
		return count - 1;
	}

	//==============================================================================
	// 우주선 합산 스탯 계산.
	//==============================================================================
	/**
	 * @returns { object }
	 */
	calculateShipStats() {
		const grid = this.getGrid();
		return calculateStatsForGrid(grid);
	}

	//==============================================================================
	// 모듈 구매. (골드가 충분할 때 인벤토리 증가)
	//==============================================================================
	/**
	 * @param { number } partIndex
	 */
	buyModule(partIndex) {
		const partDefinition = PartDefinitions[partIndex];
		const price = partDefinition.price;
		const playerGold = this.getPlayerGold();
		if (playerGold < price) {
			return;
		}
		this.#playerGold = playerGold - price;
		this.#inventory[partIndex] += 1;
	}

	//==============================================================================
	// 빌드 화면 레이아웃 계산.
	// 외부 하드코딩 위치 대신 현재 뷰 크기를 읽어 런타임에 배치를 계산한다.
	//==============================================================================
	/**
	 * @param { Vector2 } viewSize
	 * @returns { object }
	 */
	getBuildLayout(viewSize) {
		const gridAreaWidth = viewSize.x * 0.86;
		const cellSize = System.Math.floor(gridAreaWidth / GRID_COLUMNS);
		const gridWidth = cellSize * GRID_COLUMNS;
		const gridOriginX = System.Math.floor((viewSize.x - gridWidth) * 0.5);
		const gridOriginY = System.Math.floor(viewSize.y * 0.22);

		const paletteCount = ATTACHMENT_PART_INDICES.length;
		const paletteAreaWidth = viewSize.x * 0.92;
		const paletteGap = 12;
		const paletteOriginX = System.Math.floor((viewSize.x - paletteAreaWidth) * 0.5);
		const paletteOriginY = System.Math.floor(viewSize.y * 0.78);
		const paletteButtonWidth = System.Math.floor((paletteAreaWidth - paletteGap * (paletteCount - 1)) / paletteCount);
		const paletteButtonHeight = System.Math.floor(viewSize.y * 0.09);

		const paletteButtons = [];
		for (let index = 0; index < paletteCount; ++index) {
			const partIndex = ATTACHMENT_PART_INDICES[index];
			const buttonX = paletteOriginX + index * (paletteButtonWidth + paletteGap);
			paletteButtons.push({
				partIndex: partIndex,
				x: buttonX,
				y: paletteOriginY,
				width: paletteButtonWidth,
				height: paletteButtonHeight,
			});
		}

		return {
			cellSize: cellSize,
			gridOriginX: gridOriginX,
			gridOriginY: gridOriginY,
			paletteButtons: paletteButtons,
		};
	}

	//==============================================================================
	// 뷰 위치에 해당하는 그리드 칸 반환.
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition
	 * @param { object } layout
	 * @returns { object }
	 */
	getGridCellAt(viewPosition, layout) {
		const cellSize = layout.cellSize;
		const gridOriginX = layout.gridOriginX;
		const gridOriginY = layout.gridOriginY;
		const column = System.Math.floor((viewPosition.x - gridOriginX) / cellSize);
		const row = System.Math.floor((viewPosition.y - gridOriginY) / cellSize);

		if (column >= 0 && column < GRID_COLUMNS && row >= 0 && row < GRID_ROWS) {
			return {
				column: column,
				row: row,
			};
		}
		return null;
	}

	//==============================================================================
	// 뷰 위치에 해당하는 팔레트 부품 인덱스 반환.
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition
	 * @param { object } layout
	 * @returns { number }
	 */
	getPalettePartIndexAt(viewPosition, layout) {
		const paletteButtons = layout.paletteButtons;
		for (const paletteButton of paletteButtons) {
			const isInside = viewPosition.x >= paletteButton.x &&
				viewPosition.x <= paletteButton.x + paletteButton.width &&
				viewPosition.y >= paletteButton.y &&
				viewPosition.y <= paletteButton.y + paletteButton.height;
			if (isInside) {
				return paletteButton.partIndex;
			}
		}
		return NO_SELECTION;
	}

	//==============================================================================
	// 상점 레이아웃 계산.
	//==============================================================================
	/**
	 * @param { Vector2 } viewSize
	 * @returns { object }
	 */
	getShopLayout(viewSize) {
		const itemOriginX = System.Math.floor(viewSize.x * 0.06);
		const itemWidth = System.Math.floor(viewSize.x * 0.88);
		const itemOriginY = System.Math.floor(viewSize.y * 0.16);
		const itemHeight = System.Math.floor(viewSize.y * 0.13);
		const itemGap = System.Math.floor(viewSize.y * 0.02);

		const items = [];
		for (let index = 0; index < ATTACHMENT_PART_INDICES.length; ++index) {
			const partIndex = ATTACHMENT_PART_INDICES[index];
			items.push({
				partIndex: partIndex,
				x: itemOriginX,
				y: itemOriginY + index * (itemHeight + itemGap),
				width: itemWidth,
				height: itemHeight,
			});
		}

		return {
			items: items,
		};
	}

	//==============================================================================
	// 뷰 위치에 해당하는 상점 항목 부품 인덱스 반환.
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition
	 * @param { object } shopLayout
	 * @returns { number }
	 */
	getShopItemPartIndexAt(viewPosition, shopLayout) {
		const items = shopLayout.items;
		for (const item of items) {
			const isInside = viewPosition.x >= item.x &&
				viewPosition.x <= item.x + item.width &&
				viewPosition.y >= item.y &&
				viewPosition.y <= item.y + item.height;
			if (isInside) {
				return item.partIndex;
			}
		}
		return NO_SELECTION;
	}

	//==============================================================================
	// 하단 네비게이션 레이아웃 계산.
	//==============================================================================
	/**
	 * @param { Vector2 } viewSize
	 * @returns { object }
	 */
	getNavigationLayout(viewSize) {
		const barHeight = System.Math.floor(viewSize.y * 0.09);
		const barY = viewSize.y - barHeight;

		const tabInfos = [
			{
				tab: AppTab.build,
				label: "조립",
			},
			{
				tab: AppTab.shop,
				label: "상점",
			},
			{
				tab: AppTab.battle,
				label: "전투",
			},
			{
				tab: AppTab.settings,
				label: "설정",
			},
		];

		const buttonWidth = viewSize.x / tabInfos.length;
		const buttons = [];
		for (let index = 0; index < tabInfos.length; ++index) {
			const tabInfo = tabInfos[index];
			buttons.push({
				tab: tabInfo.tab,
				label: tabInfo.label,
				x: System.Math.floor(buttonWidth * index),
				y: barY,
				width: System.Math.floor(buttonWidth),
				height: barHeight,
			});
		}

		return {
			barY: barY,
			barHeight: barHeight,
			buttons: buttons,
		};
	}

	//==============================================================================
	// 뷰 위치에 해당하는 네비게이션 탭 반환.
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition
	 * @param { object } navigationLayout
	 * @returns { number }
	 */
	getNavigationTabAt(viewPosition, navigationLayout) {
		const buttons = navigationLayout.buttons;
		for (const button of buttons) {
			const isInside = viewPosition.x >= button.x &&
				viewPosition.x <= button.x + button.width &&
				viewPosition.y >= button.y &&
				viewPosition.y <= button.y + button.height;
			if (isInside) {
				return button.tab;
			}
		}
		return NO_SELECTION;
	}

	//==============================================================================
	// 전투 탭 적 목록 레이아웃 계산.
	//==============================================================================
	/**
	 * @param { Vector2 } viewSize
	 * @returns { object }
	 */
	getBattleLayout(viewSize) {
		const listOriginX = System.Math.floor(viewSize.x * 0.06);
		const listWidth = System.Math.floor(viewSize.x * 0.88);
		const listOriginY = System.Math.floor(viewSize.y * 0.15);
		const itemHeight = System.Math.floor(viewSize.y * 0.13);
		const itemGap = System.Math.floor(viewSize.y * 0.013);

		const enemyList = this.getEnemyList();
		const items = [];
		for (let index = 0; index < enemyList.length; ++index) {
			items.push({
				index: index,
				x: listOriginX,
				y: listOriginY + index * (itemHeight + itemGap),
				width: listWidth,
				height: itemHeight,
			});
		}

		return {
			items: items,
		};
	}

	//==============================================================================
	// 뷰 위치에 해당하는 적 목록 인덱스 반환.
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition
	 * @param { object } battleLayout
	 * @returns { number }
	 */
	getBattleItemAt(viewPosition, battleLayout) {
		const items = battleLayout.items;
		for (const item of items) {
			const isInside = viewPosition.x >= item.x &&
				viewPosition.x <= item.x + item.width &&
				viewPosition.y >= item.y &&
				viewPosition.y <= item.y + item.height;
			if (isInside) {
				return item.index;
			}
		}
		return NO_SELECTION;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @protected
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		super.tick(timeDelta);

		const engine = this.getEngine();
		const inputManager = engine.getInputManager();
		if (!inputManager.isTouchPressed()) {
			return;
		}

		const viewManager = engine.getViewManager();
		const viewSize = viewManager.getViewSize();
		const viewInputPosition = inputManager.getViewInputPosition();

		// 네비게이션 탭 전환 우선 처리.
		const navigationLayout = this.getNavigationLayout(viewSize);
		const navigationTab = this.getNavigationTabAt(viewInputPosition, navigationLayout);
		if (navigationTab !== NO_SELECTION) {
			this.#currentTab = navigationTab;
			return;
		}

		// 현재 탭 콘텐츠 입력 처리.
		const currentTab = this.getCurrentTab();
		switch (currentTab) {
			case AppTab.build: {
					this.tickBuildTab(viewSize, viewInputPosition);
					break;
				}

			case AppTab.shop: {
					this.tickShopTab(viewSize, viewInputPosition);
					break;
				}

			case AppTab.battle: {
					this.tickBattleTab(viewSize, viewInputPosition);
					break;
				}

			case AppTab.settings: {
					break;
				}
		}
	}

	//==============================================================================
	// 빌드 탭 입력 처리.
	//==============================================================================
	/**
	 * @param { Vector2 } viewSize
	 * @param { Vector2 } viewInputPosition
	 */
	tickBuildTab(viewSize, viewInputPosition) {
		const layout = this.getBuildLayout(viewSize);

		// 팔레트 선택 우선 처리.
		const palettePartIndex = this.getPalettePartIndexAt(viewInputPosition, layout);
		if (palettePartIndex !== NO_SELECTION) {
			this.#selectedPartIndex = palettePartIndex;
			return;
		}

		// 그리드 칸 배치/제거 처리.
		const gridCell = this.getGridCellAt(viewInputPosition, layout);
		if (gridCell) {
			this.applyPartToCell(gridCell.column, gridCell.row);
		}
	}

	//==============================================================================
	// 상점 탭 입력 처리.
	//==============================================================================
	/**
	 * @param { Vector2 } viewSize
	 * @param { Vector2 } viewInputPosition
	 */
	tickShopTab(viewSize, viewInputPosition) {
		const shopLayout = this.getShopLayout(viewSize);
		const partIndex = this.getShopItemPartIndexAt(viewInputPosition, shopLayout);
		if (partIndex !== NO_SELECTION) {
			this.buyModule(partIndex);
		}
	}

	//==============================================================================
	// 전투 탭 입력 처리.
	//==============================================================================
	/**
	 * @param { Vector2 } viewSize
	 * @param { Vector2 } viewInputPosition
	 */
	tickBattleTab(viewSize, viewInputPosition) {
		const battleLayout = this.getBattleLayout(viewSize);
		const itemIndex = this.getBattleItemAt(viewInputPosition, battleLayout);
		if (itemIndex !== NO_SELECTION) {
			this.#selectedEnemyIndex = itemIndex;
		}
	}

	//==============================================================================
	// 그리드 칸에 선택 부품 배치 또는 제거.
	// 배치: 보유 수량 > 0 + 최대 부착물 수 이하 + 기존 부품과 인접해야 한다.
	// 제거: 제거 후에도 모든 부품이 코어와 연결되어야 하며, 보유 수량으로 반환된다.
	//==============================================================================
	/**
	 * @param { number } column
	 * @param { number } row
	 */
	applyPartToCell(column, row) {
		// 코어 칸은 고정.
		if (column === CORE_COLUMN && row === CORE_ROW) {
			return;
		}

		const grid = this.getGrid();
		const currentPartIndex = grid[column][row];
		if (currentPartIndex === EMPTY_CELL) {
			// 배치.
			const selectedPartIndex = this.getSelectedPartIndex();
			const inventoryCount = this.getInventoryCount(selectedPartIndex);
			if (inventoryCount <= 0) {
				return;
			}
			const attachmentCount = this.countAttachments();
			const maxAttachments = this.getMaxAttachments();
			if (attachmentCount >= maxAttachments) {
				return;
			}
			const isAdjacent = this.isAdjacentToPart(column, row);
			if (!isAdjacent) {
				return;
			}
			grid[column][row] = selectedPartIndex;
			this.#inventory[selectedPartIndex] -= 1;
		}
		else {
			// 제거. (연결이 끊기면 되돌린다.)
			grid[column][row] = EMPTY_CELL;
			const isConnected = this.isAllConnected();
			if (!isConnected) {
				grid[column][row] = currentPartIndex;
				return;
			}
			this.#inventory[currentPartIndex] += 1;
		}
	}

	//==============================================================================
	// 대상 칸이 다른 부품과 인접하는지 여부 반환.
	//==============================================================================
	/**
	 * @param { number } column
	 * @param { number } row
	 * @returns { boolean }
	 */
	isAdjacentToPart(column, row) {
		const grid = this.getGrid();
		return isAdjacentInGrid(grid, column, row);
	}

	//==============================================================================
	// 모든 부품이 코어와 연결되어 있는지 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isAllConnected() {
		const grid = this.getGrid();
		return isAllConnectedInGrid(grid);
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		super.draw(graphic);

		const engine = this.getEngine();
		const canvasRenderingContext = graphic.getCanvasRenderingContext();
		const viewManager = engine.getViewManager();
		const canvasNativeSize = viewManager.getCanvasNativeSize();
		const viewSize = viewManager.getViewSize();

		// 화면 바깥(레터박스) 영역.
		viewManager.applyCanvasNativeRect(canvasRenderingContext);
		canvasRenderingContext.fillStyle = "#05070f";
		canvasRenderingContext.fillRect(0, 0, canvasNativeSize.x, canvasNativeSize.y);

		// 게임 영역 배경.
		viewManager.applyViewRect(canvasRenderingContext);
		canvasRenderingContext.fillStyle = "#11162a";
		canvasRenderingContext.fillRect(0, 0, viewSize.x, viewSize.y);

		// 현재 탭 콘텐츠 출력.
		const currentTab = this.getCurrentTab();
		switch (currentTab) {
			case AppTab.build: {
					this.drawBuildTab(canvasRenderingContext, viewSize);
					break;
				}

			case AppTab.shop: {
					this.drawShopTab(canvasRenderingContext, viewSize);
					break;
				}

			case AppTab.battle: {
					this.drawBattleTab(canvasRenderingContext, viewSize);
					break;
				}

			case AppTab.settings: {
					this.drawSettingsTab(canvasRenderingContext, viewSize);
					break;
				}
		}

		// 상단 바 출력. (항상 위에 표시)
		this.drawTopBar(canvasRenderingContext, viewSize);

		// 하단 네비게이션 출력. (항상 위에 표시)
		this.drawNavigationBar(canvasRenderingContext, viewSize);
	}

	//==============================================================================
	// 상단 바 출력. (내 레벨 / 골드)
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { Vector2 } viewSize
	 */
	drawTopBar(canvasRenderingContext, viewSize) {
		const barHeight = System.Math.floor(viewSize.y * 0.055);

		// 바 배경.
		canvasRenderingContext.fillStyle = "#0a0e1a";
		canvasRenderingContext.fillRect(0, 0, viewSize.x, barHeight);

		// 바 하단 구분선.
		canvasRenderingContext.strokeStyle = "#2a3350";
		canvasRenderingContext.lineWidth = 2;
		canvasRenderingContext.beginPath();
		canvasRenderingContext.moveTo(0, barHeight);
		canvasRenderingContext.lineTo(viewSize.x, barHeight);
		canvasRenderingContext.stroke();

		const barCenterY = barHeight * 0.5;

		// 레벨 (좌측).
		const playerLevel = this.getPlayerLevel();
		canvasRenderingContext.fillStyle = "#ffffff";
		canvasRenderingContext.font = "bold 28px sans-serif";
		canvasRenderingContext.textAlign = "left";
		canvasRenderingContext.textBaseline = "middle";
		canvasRenderingContext.fillText(`레벨 ${playerLevel}`, viewSize.x * 0.05, barCenterY);

		// 골드 (우측).
		const playerGold = this.getPlayerGold();
		canvasRenderingContext.fillStyle = "#ffd24a";
		canvasRenderingContext.textAlign = "right";
		canvasRenderingContext.fillText(`골드 ${playerGold}`, viewSize.x * 0.95, barCenterY);
	}

	//==============================================================================
	// 빌드 탭 출력.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { Vector2 } viewSize
	 */
	drawBuildTab(canvasRenderingContext, viewSize) {
		const layout = this.getBuildLayout(viewSize);
		this.drawBuildHeader(canvasRenderingContext, viewSize);
		this.drawGrid(canvasRenderingContext, layout);
		this.drawPalette(canvasRenderingContext, layout);
	}

	//==============================================================================
	// 빌드 탭 상단 제목 및 스탯 출력.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { Vector2 } viewSize
	 */
	drawBuildHeader(canvasRenderingContext, viewSize) {
		canvasRenderingContext.fillStyle = "#ffffff";
		canvasRenderingContext.font = "bold 44px sans-serif";
		canvasRenderingContext.textAlign = "center";
		canvasRenderingContext.textBaseline = "top";
		canvasRenderingContext.fillText("우주선 조립", viewSize.x * 0.5, viewSize.y * 0.08);

		const shipStats = this.calculateShipStats();
		const statsText = `체력 ${shipStats.health}   공격력 ${shipStats.attack}   속도 ${shipStats.speed}`;
		canvasRenderingContext.fillStyle = "#aab4d4";
		canvasRenderingContext.font = "26px sans-serif";
		canvasRenderingContext.fillText(statsText, viewSize.x * 0.5, viewSize.y * 0.135);

		const attachmentCount = this.countAttachments();
		const maxAttachments = this.getMaxAttachments();
		const attachmentText = `부착물 ${attachmentCount} / ${maxAttachments}`;
		let attachmentColor = "#7fd6a0";
		if (attachmentCount >= maxAttachments) {
			attachmentColor = "#ff9a9a";
		}
		canvasRenderingContext.fillStyle = attachmentColor;
		canvasRenderingContext.font = "bold 26px sans-serif";
		canvasRenderingContext.fillText(attachmentText, viewSize.x * 0.5, viewSize.y * 0.17);
	}

	//==============================================================================
	// 그리드 및 배치된 부품 출력.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { object } layout
	 */
	drawGrid(canvasRenderingContext, layout) {
		const cellSize = layout.cellSize;
		const gridOriginX = layout.gridOriginX;
		const gridOriginY = layout.gridOriginY;
		const grid = this.getGrid();

		for (let column = 0; column < GRID_COLUMNS; ++column) {
			for (let row = 0; row < GRID_ROWS; ++row) {
				const cellX = gridOriginX + column * cellSize;
				const cellY = gridOriginY + row * cellSize;

				// 빈 칸은 배치 가능 위치를 흐리게만 표시한다.
				const partIndex = grid[column][row];
				if (partIndex === EMPTY_CELL) {
					canvasRenderingContext.strokeStyle = "rgba(140, 160, 220, 0.15)";
					canvasRenderingContext.lineWidth = 1;
					canvasRenderingContext.strokeRect(cellX + 0.5, cellY + 0.5, cellSize - 1, cellSize - 1);
					continue;
				}

				// 배치된 부품 박스는 칸을 꽉 채워 인접 부품과 맞붙는다.
				this.drawPart(canvasRenderingContext, partIndex, cellX, cellY, cellSize);
			}
		}
	}

	//==============================================================================
	// 단일 부품 출력. (모서리를 깎은 팔각형 + 중앙 원 + 식별 문자)
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { number } partIndex
	 * @param { number } cellX
	 * @param { number } cellY
	 * @param { number } cellSize
	 */
	drawPart(canvasRenderingContext, partIndex, cellX, cellY, cellSize) {
		const partDefinition = PartDefinitions[partIndex];
		const centerX = cellX + cellSize * 0.5;
		const centerY = cellY + cellSize * 0.5;
		const cornerCut = cellSize * 0.22;

		// 모서리를 깎은 팔각형 본체.
		canvasRenderingContext.fillStyle = partDefinition.color;
		canvasRenderingContext.beginPath();
		canvasRenderingContext.moveTo(cellX + cornerCut, cellY);
		canvasRenderingContext.lineTo(cellX + cellSize - cornerCut, cellY);
		canvasRenderingContext.lineTo(cellX + cellSize, cellY + cornerCut);
		canvasRenderingContext.lineTo(cellX + cellSize, cellY + cellSize - cornerCut);
		canvasRenderingContext.lineTo(cellX + cellSize - cornerCut, cellY + cellSize);
		canvasRenderingContext.lineTo(cellX + cornerCut, cellY + cellSize);
		canvasRenderingContext.lineTo(cellX, cellY + cellSize - cornerCut);
		canvasRenderingContext.lineTo(cellX, cellY + cornerCut);
		canvasRenderingContext.closePath();
		canvasRenderingContext.fill();

		// 중앙 원.
		const circleRadius = cellSize * 0.26;
		canvasRenderingContext.fillStyle = "rgba(12, 18, 30, 0.85)";
		canvasRenderingContext.beginPath();
		canvasRenderingContext.arc(centerX, centerY, circleRadius, 0, System.Math.PI * 2);
		canvasRenderingContext.closePath();
		canvasRenderingContext.fill();

		// 원 안 식별 문자.
		const fontSize = System.Math.max(16, System.Math.floor(cellSize * 0.30));
		canvasRenderingContext.fillStyle = "#ffffff";
		canvasRenderingContext.font = `bold ${fontSize}px sans-serif`;
		canvasRenderingContext.textAlign = "center";
		canvasRenderingContext.textBaseline = "middle";
		canvasRenderingContext.fillText(partDefinition.symbol, centerX, centerY);
	}

	//==============================================================================
	// 우주선 그리드 썸네일 출력. (작은 색 박스 모음)
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { Array<Array<number>> } grid
	 * @param { number } originX
	 * @param { number } originY
	 * @param { number } totalSize
	 */
	drawShipThumbnail(canvasRenderingContext, grid, originX, originY, totalSize) {
		const thumbnailCellSize = totalSize / GRID_COLUMNS;
		for (let column = 0; column < GRID_COLUMNS; ++column) {
			for (let row = 0; row < GRID_ROWS; ++row) {
				const partIndex = grid[column][row];
				if (partIndex === EMPTY_CELL) {
					continue;
				}
				const partDefinition = PartDefinitions[partIndex];
				const boxX = originX + column * thumbnailCellSize;
				const boxY = originY + row * thumbnailCellSize;
				canvasRenderingContext.fillStyle = partDefinition.color;
				canvasRenderingContext.fillRect(boxX, boxY, thumbnailCellSize - 1, thumbnailCellSize - 1);
			}
		}
	}

	//==============================================================================
	// 하단 부품 팔레트 출력. (보유 수량 표시)
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { object } layout
	 */
	drawPalette(canvasRenderingContext, layout) {
		const paletteButtons = layout.paletteButtons;
		const selectedPartIndex = this.getSelectedPartIndex();

		for (const paletteButton of paletteButtons) {
			const partIndex = paletteButton.partIndex;
			const partDefinition = PartDefinitions[partIndex];
			const inventoryCount = this.getInventoryCount(partIndex);

			// 버튼 배경.
			canvasRenderingContext.fillStyle = partDefinition.color;
			canvasRenderingContext.fillRect(paletteButton.x, paletteButton.y, paletteButton.width, paletteButton.height);

			// 선택 표시 외곽선.
			if (partIndex === selectedPartIndex) {
				canvasRenderingContext.strokeStyle = "#ffffff";
				canvasRenderingContext.lineWidth = 4;
				canvasRenderingContext.strokeRect(paletteButton.x + 2, paletteButton.y + 2, paletteButton.width - 4, paletteButton.height - 4);
			}

			// 버튼 이름 + 보유 수량.
			const buttonCenterX = paletteButton.x + paletteButton.width * 0.5;
			const buttonCenterY = paletteButton.y + paletteButton.height * 0.5;
			const paletteLabel = `${partDefinition.name} (${inventoryCount})`;
			canvasRenderingContext.fillStyle = "#101010";
			canvasRenderingContext.font = "bold 24px sans-serif";
			canvasRenderingContext.textAlign = "center";
			canvasRenderingContext.textBaseline = "middle";
			canvasRenderingContext.fillText(paletteLabel, buttonCenterX, buttonCenterY);
		}
	}

	//==============================================================================
	// 상점 탭 출력.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { Vector2 } viewSize
	 */
	drawShopTab(canvasRenderingContext, viewSize) {
		// 제목.
		canvasRenderingContext.fillStyle = "#ffffff";
		canvasRenderingContext.font = "bold 44px sans-serif";
		canvasRenderingContext.textAlign = "center";
		canvasRenderingContext.textBaseline = "top";
		canvasRenderingContext.fillText("상점", viewSize.x * 0.5, viewSize.y * 0.08);

		const shopLayout = this.getShopLayout(viewSize);
		const items = shopLayout.items;

		for (const item of items) {
			const partIndex = item.partIndex;
			const partDefinition = PartDefinitions[partIndex];
			const inventoryCount = this.getInventoryCount(partIndex);

			// 항목 배경.
			canvasRenderingContext.fillStyle = "#1b2238";
			canvasRenderingContext.fillRect(item.x, item.y, item.width, item.height);

			// 좌측 모듈 색 박스.
			const colorBoxSize = item.height * 0.6;
			const colorBoxX = item.x + item.height * 0.2;
			const colorBoxY = item.y + item.height * 0.2;
			canvasRenderingContext.fillStyle = partDefinition.color;
			canvasRenderingContext.fillRect(colorBoxX, colorBoxY, colorBoxSize, colorBoxSize);

			// 모듈 이름.
			const textX = colorBoxX + colorBoxSize + item.width * 0.04;
			canvasRenderingContext.fillStyle = "#ffffff";
			canvasRenderingContext.font = "bold 30px sans-serif";
			canvasRenderingContext.textAlign = "left";
			canvasRenderingContext.textBaseline = "middle";
			canvasRenderingContext.fillText(partDefinition.name, textX, item.y + item.height * 0.34);

			// 보유 수량.
			canvasRenderingContext.fillStyle = "#aab4d4";
			canvasRenderingContext.font = "24px sans-serif";
			canvasRenderingContext.fillText(`보유 ${inventoryCount}`, textX, item.y + item.height * 0.68);

			// 우측 가격 + 구매 안내.
			canvasRenderingContext.fillStyle = "#ffd24a";
			canvasRenderingContext.font = "bold 30px sans-serif";
			canvasRenderingContext.textAlign = "right";
			canvasRenderingContext.fillText(`${partDefinition.price} 골드`, item.x + item.width - item.width * 0.04, item.y + item.height * 0.34);

			canvasRenderingContext.fillStyle = "#7fd6a0";
			canvasRenderingContext.font = "22px sans-serif";
			canvasRenderingContext.fillText("탭하여 구매", item.x + item.width - item.width * 0.04, item.y + item.height * 0.68);
		}
	}

	//==============================================================================
	// 전투 탭 출력. (무작위 적 목록 + 썸네일)
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { Vector2 } viewSize
	 */
	drawBattleTab(canvasRenderingContext, viewSize) {
		// 제목.
		canvasRenderingContext.fillStyle = "#ffffff";
		canvasRenderingContext.font = "bold 44px sans-serif";
		canvasRenderingContext.textAlign = "center";
		canvasRenderingContext.textBaseline = "top";
		canvasRenderingContext.fillText("전투 상대 선택", viewSize.x * 0.5, viewSize.y * 0.08);

		const battleLayout = this.getBattleLayout(viewSize);
		const enemyList = this.getEnemyList();
		const selectedEnemyIndex = this.getSelectedEnemyIndex();
		const items = battleLayout.items;

		for (const item of items) {
			const enemy = enemyList[item.index];
			const isSelected = item.index === selectedEnemyIndex;

			// 항목 배경.
			let backgroundColor = "#1b2238";
			if (isSelected) {
				backgroundColor = "#2c3a66";
			}
			canvasRenderingContext.fillStyle = backgroundColor;
			canvasRenderingContext.fillRect(item.x, item.y, item.width, item.height);

			// 선택 표시 외곽선.
			if (isSelected) {
				canvasRenderingContext.strokeStyle = "#ffffff";
				canvasRenderingContext.lineWidth = 3;
				canvasRenderingContext.strokeRect(item.x + 2, item.y + 2, item.width - 4, item.height - 4);
			}

			// 좌측 우주선 썸네일.
			const thumbnailSize = item.height * 0.78;
			const thumbnailX = item.x + item.height * 0.11;
			const thumbnailY = item.y + item.height * 0.11;
			this.drawShipThumbnail(canvasRenderingContext, enemy.grid, thumbnailX, thumbnailY, thumbnailSize);

			// 적 이름.
			const textX = thumbnailX + thumbnailSize + item.width * 0.04;
			canvasRenderingContext.fillStyle = "#ffffff";
			canvasRenderingContext.font = "bold 30px sans-serif";
			canvasRenderingContext.textAlign = "left";
			canvasRenderingContext.textBaseline = "middle";
			canvasRenderingContext.fillText(enemy.name, textX, item.y + item.height * 0.34);

			// 적 스탯.
			const enemyStatsText = `체력 ${enemy.stats.health}   공격 ${enemy.stats.attack}   속도 ${enemy.stats.speed}`;
			canvasRenderingContext.fillStyle = "#aab4d4";
			canvasRenderingContext.font = "22px sans-serif";
			canvasRenderingContext.fillText(enemyStatsText, textX, item.y + item.height * 0.68);
		}
	}

	//==============================================================================
	// 설정 탭 출력. (추후 정의)
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { Vector2 } viewSize
	 */
	drawSettingsTab(canvasRenderingContext, viewSize) {
		canvasRenderingContext.fillStyle = "#ffffff";
		canvasRenderingContext.font = "bold 44px sans-serif";
		canvasRenderingContext.textAlign = "center";
		canvasRenderingContext.textBaseline = "top";
		canvasRenderingContext.fillText("설정", viewSize.x * 0.5, viewSize.y * 0.08);

		canvasRenderingContext.fillStyle = "#7a85a8";
		canvasRenderingContext.font = "28px sans-serif";
		canvasRenderingContext.textBaseline = "middle";
		canvasRenderingContext.fillText("준비 중입니다.", viewSize.x * 0.5, viewSize.y * 0.45);
	}

	//==============================================================================
	// 하단 네비게이션 바 출력.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { Vector2 } viewSize
	 */
	drawNavigationBar(canvasRenderingContext, viewSize) {
		const navigationLayout = this.getNavigationLayout(viewSize);
		const currentTab = this.getCurrentTab();

		// 바 배경.
		canvasRenderingContext.fillStyle = "#0a0e1a";
		canvasRenderingContext.fillRect(0, navigationLayout.barY, viewSize.x, navigationLayout.barHeight);

		// 바 상단 구분선.
		canvasRenderingContext.strokeStyle = "#2a3350";
		canvasRenderingContext.lineWidth = 2;
		canvasRenderingContext.beginPath();
		canvasRenderingContext.moveTo(0, navigationLayout.barY);
		canvasRenderingContext.lineTo(viewSize.x, navigationLayout.barY);
		canvasRenderingContext.stroke();

		const buttons = navigationLayout.buttons;
		for (const button of buttons) {
			const isActive = button.tab === currentTab;

			// 활성 탭 배경.
			if (isActive) {
				canvasRenderingContext.fillStyle = "#1a2240";
				canvasRenderingContext.fillRect(button.x, button.y, button.width, button.height);
			}

			// 탭 이름.
			let labelColor = "#7a85a8";
			if (isActive) {
				labelColor = "#ffffff";
			}
			const buttonCenterX = button.x + button.width * 0.5;
			const buttonCenterY = button.y + button.height * 0.5;
			canvasRenderingContext.fillStyle = labelColor;
			canvasRenderingContext.font = "bold 28px sans-serif";
			canvasRenderingContext.textAlign = "center";
			canvasRenderingContext.textBaseline = "middle";
			canvasRenderingContext.fillText(button.label, buttonCenterX, buttonCenterY);
		}
	}
}


//==============================================================================
// 엔진 기동.
//==============================================================================
const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(800, 1280);
engineConfiguration.useStatistics = false;
const engine = new Engine(engineConfiguration);
document.title = "playablegames-template";
const scene = new AppScene();
engine.run(scene);
